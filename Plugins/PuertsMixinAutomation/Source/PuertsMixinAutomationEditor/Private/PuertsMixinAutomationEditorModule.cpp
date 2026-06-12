// PuertsMixinAutomation 编辑器模块实现。
//
// 工作流程概览：
//   Blueprint 保存 / 右键菜单 / CodeGenerator 手动触发
//        ↓
//   刷新 TypeScript 声明（ue_bp.d.ts）
//        ↓
//   按配置为 Blueprint 生成 Mixin .ts 模板（Node 脚本）
//        ↓
//   重写 mixin-imports.ts 聚合索引，必要时创建 register.ts 入口

#include "PuertsMixinAutomationEditorModule.h"

#include "AssetRegistry/IAssetRegistry.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Blueprint/WidgetBlueprintGeneratedClass.h"
#include "CodeGenerator.h"
#include "ContentBrowserModule.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "Framework/Commands/UIAction.h"
#include "Framework/MultiBox/MultiBoxBuilder.h"
#include "Dom/JsonObject.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformProcess.h"
#include "HAL/PlatformTime.h"
#include "IDeclarationGenerator.h"
#include "ISettingsModule.h"
#include "Misc/FileHelper.h"
#include "Misc/MessageDialog.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "PuertsMixinAutomationSettings.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "UObject/Package.h"
#include "UObject/UObjectGlobals.h"

#define LOCTEXT_NAMESPACE "FPuertsMixinAutomationEditorModule"

// ---------------------------------------------------------------------------
// 匿名命名空间：路径规范化与资产筛选辅助函数
// ---------------------------------------------------------------------------
namespace
{
/** 规范化 Content 资产根路径：统一斜杠、补全 /Game 前缀、去除末尾斜杠 */
FString NormalizeAssetRoot(FString Path)
{
    Path.TrimStartAndEndInline();
    Path.ReplaceInline(TEXT("\\"), TEXT("/"));

    if (Path.IsEmpty())
    {
        Path = TEXT("/Game/Blueprints");
    }
    if (!Path.StartsWith(TEXT("/")))
    {
        Path = TEXT("/") + Path;
    }
    while (Path.Len() > 1 && Path.EndsWith(TEXT("/")))
    {
        Path.LeftChopInline(1);
    }
    return Path;
}

/** 规范化项目相对路径：统一斜杠并去除开头的 / */
FString NormalizeProjectRelativePath(FString Path)
{
    Path.TrimStartAndEndInline();
    Path.ReplaceInline(TEXT("\\"), TEXT("/"));
    while (Path.StartsWith(TEXT("/")))
    {
        Path.RightChopInline(1);
    }
    return Path;
}

/** 将项目相对路径转换为磁盘绝对路径 */
FString ToProjectAbsolutePath(const FString& ProjectRelativePath)
{
    return FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / NormalizeProjectRelativePath(ProjectRelativePath));
}

/** 判断包名/路径是否位于指定资产根路径下（含根路径本身） */
bool IsUnderAssetRoot(const FString& PackageNameOrPath, const FString& RootPath)
{
    return PackageNameOrPath == RootPath || PackageNameOrPath.StartsWith(RootPath / TEXT(""));
}

/** 从完整包名中剥离根路径，得到用于映射 mixin 文件目录的相对路径 */
FString MakeRelativePackagePath(const FString& PackageName, const FString& RootPath)
{
    FString RelativePath = PackageName;
    if (RelativePath.StartsWith(RootPath))
    {
        RelativePath.RightChopInline(RootPath.Len());
    }
    while (RelativePath.StartsWith(TEXT("/")))
    {
        RelativePath.RightChopInline(1);
    }
    return RelativePath;
}

/** AssetRegistry 重命名回调给的是 ObjectPath，脚本层需要 PackageName */
FString MakePackageNameFromObjectPath(FString ObjectPath)
{
    ObjectPath.ReplaceInline(TEXT("\\"), TEXT("/"));
    int32 DotIndex = INDEX_NONE;
    if (ObjectPath.FindChar(TEXT('.'), DotIndex))
    {
        ObjectPath.LeftInline(DotIndex);
    }
    return ObjectPath;
}

/** 计算 TypeScript import 相对路径（不含 .ts 后缀，以 ./ 开头） */
FString MakeImportPath(const FString& FromDirectory, const FString& ToFile)
{
    FString FromNorm = FPaths::ConvertRelativePathToFull(FromDirectory);
    FString ToNorm = FPaths::ConvertRelativePathToFull(ToFile);
    FromNorm.ReplaceInline(TEXT("\\"), TEXT("/"));
    ToNorm.ReplaceInline(TEXT("\\"), TEXT("/"));

    TArray<FString> FromSegments;
    TArray<FString> ToSegments;
    FromNorm.ParseIntoArray(FromSegments, TEXT("/"), true);
    ToNorm.ParseIntoArray(ToSegments, TEXT("/"), true);

    // 找到 From/To 路径的公共前缀长度，用于计算相对路径
    int32 Prefix = 0;
    while (Prefix < FromSegments.Num() && Prefix < ToSegments.Num()
        && FromSegments[Prefix].Equals(ToSegments[Prefix], ESearchCase::IgnoreCase))
    {
        ++Prefix;
    }

    TArray<FString> RelativeParts;

    RelativeParts.Reserve((FromSegments.Num() - Prefix) + (ToSegments.Num() - Prefix));
    for (int32 Index = Prefix; Index < FromSegments.Num(); ++Index)
    {
        RelativeParts.Add(TEXT(".."));
    }
    for (int32 Index = Prefix; Index < ToSegments.Num(); ++Index)
    {
        RelativeParts.Add(ToSegments[Index]);
    }

    FString RelativePath = FString::Join(RelativeParts, TEXT("/"));
    if (RelativePath.IsEmpty())
    {
        RelativePath = TEXT(".");
    }

    if (RelativePath.EndsWith(TEXT(".ts")))
    {
        RelativePath.LeftChopInline(3);
    }

    if (!RelativePath.StartsWith(TEXT(".")))
    {
        RelativePath = TEXT("./") + RelativePath;
    }

    return RelativePath;
}

/** Puerts mixin 原生实现处理 BlueprintGeneratedClass，并对 WidgetBlueprintGeneratedClass 有专门分支 */
bool IsPuertsMixinSupportedGeneratedClass(const UClass* GeneratedClass)
{
    return GeneratedClass
        && (Cast<UBlueprintGeneratedClass>(GeneratedClass) || Cast<UWidgetBlueprintGeneratedClass>(GeneratedClass));
}

/** 判断资产是否为可被 Puerts blueprint.mixin 处理的 Blueprint 资产 */
bool IsPuertsMixinSupportedBlueprintAsset(const FAssetData& AssetData)
{
    const UClass* AssetClass = AssetData.GetClass();
    if (!AssetClass || !AssetClass->IsChildOf(UBlueprint::StaticClass()))
    {
        return false;
    }

    const UBlueprint* Blueprint = Cast<UBlueprint>(AssetData.GetAsset());
    return Blueprint && IsPuertsMixinSupportedGeneratedClass(Blueprint->GeneratedClass);
}

/** 根据配置决定自动创建 Mixin 模板时扫描哪个 Blueprint 根目录 */
bool TryGetAutoCreateScanRoot(const UPuertsMixinAutomationSettings* Settings, FString& OutScanRoot)
{
    if (!Settings || Settings->AutoCreateMixinPolicy == EPuertsMixinAutoCreatePolicy::Disabled)
    {
        return false;
    }

    OutScanRoot = Settings->AutoCreateMixinPolicy == EPuertsMixinAutoCreatePolicy::All
        ? NormalizeAssetRoot(Settings->BlueprintRootPath)
        : NormalizeAssetRoot(Settings->ScriptedBlueprintRootPath);

    return true;
}
}    // namespace

// ---------------------------------------------------------------------------
// 模块生命周期
// ---------------------------------------------------------------------------

FPuertsMixinAutomationEditorModule& FPuertsMixinAutomationEditorModule::Get()
{
    return FModuleManager::LoadModuleChecked<FPuertsMixinAutomationEditorModule>("PuertsMixinAutomationEditor");
}

bool FPuertsMixinAutomationEditorModule::IsAvailable()
{
    return FModuleManager::Get().IsModuleLoaded("PuertsMixinAutomationEditor");
}

void FPuertsMixinAutomationEditorModule::StartupModule()
{
    RegisterSettings();
    RegisterAssetCallbacks();
    RegisterContentBrowserMenuExtender();
}

void FPuertsMixinAutomationEditorModule::ShutdownModule()
{
    // 注销顺序与 Startup 相反，确保委托与 Ticker 在模块卸载前释放
    UnregisterContentBrowserMenuExtender();
    UnregisterAssetCallbacks();
    UnregisterSettings();
}

// ---------------------------------------------------------------------------
// 项目设置（Project Settings -> Plugins -> Puerts Mixin Automation）
// ---------------------------------------------------------------------------

void FPuertsMixinAutomationEditorModule::RegisterSettings()
{
    if (ISettingsModule* SettingsModule = FModuleManager::GetModulePtr<ISettingsModule>("Settings"))
    {
        SettingsModule->RegisterSettings("Project", "Plugins", "PuertsMixinAutomation",
            LOCTEXT("SettingsName", "Puerts Mixin Automation"),
            LOCTEXT("SettingsDescription", "Configure Puerts Blueprint mixin TypeScript automation."),
            GetMutableDefault<UPuertsMixinAutomationSettings>());
    }
}

void FPuertsMixinAutomationEditorModule::UnregisterSettings()
{
    if (ISettingsModule* SettingsModule = FModuleManager::GetModulePtr<ISettingsModule>("Settings"))
    {
        SettingsModule->UnregisterSettings("Project", "Plugins", "PuertsMixinAutomation");
    }
}

// ---------------------------------------------------------------------------
// 资产变更监听：Blueprint 保存后防抖刷新声明与 Mixin 索引
// ---------------------------------------------------------------------------

void FPuertsMixinAutomationEditorModule::RegisterAssetCallbacks()
{
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    AssetUpdatedHandle = AssetRegistryModule.Get().OnAssetUpdated().AddRaw(this, &FPuertsMixinAutomationEditorModule::OnAssetUpdated);
    AssetRenamedHandle = AssetRegistryModule.Get().OnAssetRenamed().AddRaw(this, &FPuertsMixinAutomationEditorModule::OnAssetRenamed);
    PackageSavedHandle = UPackage::PackageSavedWithContextEvent.AddRaw(this, &FPuertsMixinAutomationEditorModule::OnPackageSaved);
}

void FPuertsMixinAutomationEditorModule::UnregisterAssetCallbacks()
{
    if (PackageSavedHandle.IsValid())
    {
        UPackage::PackageSavedWithContextEvent.Remove(PackageSavedHandle);
        PackageSavedHandle.Reset();
    }

    if (AssetUpdatedHandle.IsValid() && FModuleManager::Get().IsModuleLoaded("AssetRegistry"))
    {
        FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
        AssetRegistryModule.Get().OnAssetUpdated().Remove(AssetUpdatedHandle);
        AssetUpdatedHandle.Reset();
    }

    if (AssetRenamedHandle.IsValid() && FModuleManager::Get().IsModuleLoaded("AssetRegistry"))
    {
        FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
        AssetRegistryModule.Get().OnAssetRenamed().Remove(AssetRenamedHandle);
        AssetRenamedHandle.Reset();
    }

    if (TickerHandle.IsValid())
    {
        FTSTicker::GetCoreTicker().RemoveTicker(TickerHandle);
        TickerHandle.Reset();
    }

    PendingDeclarationSearchPaths.Reset();
}

// ---------------------------------------------------------------------------
// 内容浏览器右键菜单：为选中 Blueprint 手动创建 Mixin 脚本
// ---------------------------------------------------------------------------

void FPuertsMixinAutomationEditorModule::RegisterContentBrowserMenuExtender()
{
    FContentBrowserModule& ContentBrowserModule = FModuleManager::LoadModuleChecked<FContentBrowserModule>("ContentBrowser");
    TArray<FContentBrowserMenuExtender_SelectedAssets>& MenuExtenders =
        ContentBrowserModule.GetAllAssetViewContextMenuExtenders();

    MenuExtenders.Add(FContentBrowserMenuExtender_SelectedAssets::CreateRaw(
        this, &FPuertsMixinAutomationEditorModule::OnExtendContentBrowserAssetSelectionMenu));
    ContentBrowserAssetMenuExtenderHandle = MenuExtenders.Last().GetHandle();
}

void FPuertsMixinAutomationEditorModule::UnregisterContentBrowserMenuExtender()
{
    if (!ContentBrowserAssetMenuExtenderHandle.IsValid() || !FModuleManager::Get().IsModuleLoaded("ContentBrowser"))
    {
        return;
    }

    FContentBrowserModule& ContentBrowserModule = FModuleManager::LoadModuleChecked<FContentBrowserModule>("ContentBrowser");
    TArray<FContentBrowserMenuExtender_SelectedAssets>& MenuExtenders =
        ContentBrowserModule.GetAllAssetViewContextMenuExtenders();

    MenuExtenders.RemoveAll([this](const FContentBrowserMenuExtender_SelectedAssets& Delegate) {
        return Delegate.GetHandle() == ContentBrowserAssetMenuExtenderHandle;
    });
    ContentBrowserAssetMenuExtenderHandle.Reset();
}

/** 扩展内容浏览器资产右键菜单；仅当选中项含 BlueprintRootPath 下且 Puerts 支持 mixin 的 Blueprint 资产时追加条目 */
TSharedRef<FExtender> FPuertsMixinAutomationEditorModule::OnExtendContentBrowserAssetSelectionMenu(
    const TArray<FAssetData>& SelectedAssets)
{
    TSharedRef<FExtender> Extender = MakeShared<FExtender>();
    if (!CanCreateMixinForSelectedAssets(SelectedAssets))
    {
        return Extender;
    }

    // 挂在内置「资产操作」分组之后
    Extender->AddMenuExtension("GetAssetActions", EExtensionHook::After, nullptr,
        FMenuExtensionDelegate::CreateRaw(
            this, &FPuertsMixinAutomationEditorModule::AddCreateMixinMenuEntry, SelectedAssets));
    return Extender;
}

void FPuertsMixinAutomationEditorModule::AddCreateMixinMenuEntry(
    FMenuBuilder& MenuBuilder, TArray<FAssetData> SelectedAssets)
{
    MenuBuilder.AddMenuEntry(
        LOCTEXT("CreatePuertsMixin", "Create Puerts Mixin TS Script"),
        LOCTEXT("CreatePuertsMixinTooltip",
            "Generate TypeScript mixin script(s) for the selected Blueprint asset(s), then refresh the mixin import index."),
        FSlateIcon(),
        FUIAction(
            FExecuteAction::CreateRaw(
                this, &FPuertsMixinAutomationEditorModule::ExecuteCreateMixinForSelectedAssets, SelectedAssets),
            FCanExecuteAction::CreateRaw(
                this, &FPuertsMixinAutomationEditorModule::CanCreateMixinForSelectedAssets, SelectedAssets)));
}

/** 至少有一个选中资产是 BlueprintRootPath 下且 Puerts 支持 mixin 的 Blueprint 资产时才显示菜单项 */
bool FPuertsMixinAutomationEditorModule::CanCreateMixinForSelectedAssets(TArray<FAssetData> SelectedAssets) const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return false;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    for (const FAssetData& AssetData : SelectedAssets)
    {
        if (IsPuertsMixinSupportedBlueprintAsset(AssetData) && IsUnderAssetRoot(AssetData.PackageName.ToString(), RootPath))
        {
            return true;
        }
    }
    return false;
}

/** 为每个符合条件的 Blueprint 生成 Mixin 文件，完成后统一刷新索引并弹出结果摘要 */
void FPuertsMixinAutomationEditorModule::ExecuteCreateMixinForSelectedAssets(TArray<FAssetData> SelectedAssets) const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    int32 CreatedCount = 0;
    int32 SkippedCount = 0;
    int32 FailedCount = 0;

    for (const FAssetData& AssetData : SelectedAssets)
    {
        if (!IsPuertsMixinSupportedBlueprintAsset(AssetData) || !IsUnderAssetRoot(AssetData.PackageName.ToString(), RootPath))
        {
            ++SkippedCount;
            continue;
        }

        const EMixinCreateResult Result =
            CreateMixinFileForBlueprintPackage(AssetData.PackageName.ToString(), !Settings->bCreateOnlyMissingMixins);
        if (Result == EMixinCreateResult::CreatedOrUpdated)
        {
            ++CreatedCount;
        }
        else if (Result == EMixinCreateResult::Skipped)
        {
            ++SkippedCount;
        }
        else
        {
            ++FailedCount;
        }
    }

    EnsureMixinRegisterFile();
    RunBlueprintCatalogGenerator();
    GenerateMixinIndex();

    const FText ResultMessage = FText::Format(
        LOCTEXT("CreatePuertsMixinResult", "Puerts Mixin generation finished.\nCreated/updated: {0}\nSkipped: {1}\nFailed: {2}"),
        FText::AsNumber(CreatedCount),
        FText::AsNumber(SkippedCount),
        FText::AsNumber(FailedCount));
    FMessageDialog::Open(FailedCount > 0 ? EAppMsgType::Ok : EAppMsgType::Ok, ResultMessage);
}

void FPuertsMixinAutomationEditorModule::OnAssetUpdated(const FAssetData& AssetData)
{
    // 仅处理配置根路径下且 Puerts 支持 mixin 的 Blueprint 保存事件
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings || !Settings->bGenerateOnBlueprintSave || !IsPuertsMixinSupportedBlueprintAsset(AssetData))
    {
        return;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString PackageName = AssetData.PackageName.ToString();
    if (!IsUnderAssetRoot(PackageName, RootPath))
    {
        return;
    }

    QueueDeclarationRefresh(AssetData.PackagePath);
}

void FPuertsMixinAutomationEditorModule::OnAssetRenamed(const FAssetData& AssetData, const FString& OldObjectPath)
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings || !Settings->bAutoSyncBlueprintRename || !IsPuertsMixinSupportedBlueprintAsset(AssetData))
    {
        return;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString NewPackageName = AssetData.PackageName.ToString();
    const FString OldPackageName = MakePackageNameFromObjectPath(OldObjectPath);
    if (!IsUnderAssetRoot(NewPackageName, RootPath) && !IsUnderAssetRoot(OldPackageName, RootPath))
    {
        return;
    }

    const UBlueprint* Blueprint = Cast<UBlueprint>(AssetData.GetAsset());
    if (!Blueprint || !IsPuertsMixinSupportedGeneratedClass(Blueprint->GeneratedClass))
    {
        return;
    }

    const FString Guid = Blueprint->GetBlueprintGuid().ToString(EGuidFormats::DigitsWithHyphens);
    FString ExtraArgs = FString::Printf(
        TEXT("--sync-blueprint --blueprint=\"%s\" --old-blueprint=\"%s\" --guid=\"%s\""),
        *NewPackageName,
        *OldPackageName,
        *Guid);
    if (Settings->bAutoRenameMixinFile)
    {
        ExtraArgs += TEXT(" --rename-scripts");
    }

    if (!RunBlueprintCatalogGenerator(ExtraArgs))
    {
        FMessageDialog::Open(EAppMsgType::Ok,
            FText::Format(
                LOCTEXT("SyncBlueprintRenameFailed", "Failed to sync Puerts Mixin files for renamed Blueprint:\n{0}"),
                FText::FromString(NewPackageName)));
        return;
    }

    QueueDeclarationRefresh(*FPackageName::GetLongPackagePath(NewPackageName));
}

void FPuertsMixinAutomationEditorModule::OnPackageSaved(
    const FString& /*PackageFileName*/, UPackage* Package, FObjectPostSaveContext /*ObjectSaveContext*/)
{
    // UMG 控件树等内容保存不一定触发 AssetRegistry.OnAssetUpdated，包保存回调作为主兜底。
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings || !Settings->bGenerateOnBlueprintSave || !Package)
    {
        return;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString PackageName = Package->GetName();
    if (!IsUnderAssetRoot(PackageName, RootPath))
    {
        return;
    }

    const FString AssetName = FPackageName::GetLongPackageAssetName(PackageName);
    const UBlueprint* Blueprint = FindObject<UBlueprint>(Package, *AssetName);
    if (!Blueprint || !IsPuertsMixinSupportedGeneratedClass(Blueprint->GeneratedClass))
    {
        return;
    }

    QueueDeclarationRefresh(*FPackageName::GetLongPackagePath(PackageName));
}

/** 将包路径加入待刷新集合，并启动/续期防抖 Ticker（0.25s 轮询间隔） */
void FPuertsMixinAutomationEditorModule::QueueDeclarationRefresh(FName SearchPath)
{
    PendingDeclarationSearchPaths.Add(SearchPath);
    LastBlueprintUpdateTime = FPlatformTime::Seconds();

    if (!TickerHandle.IsValid())
    {
        TickerHandle = FTSTicker::GetCoreTicker().AddTicker(
            FTickerDelegate::CreateRaw(this, &FPuertsMixinAutomationEditorModule::TickPendingDeclarationRefresh), 0.25f);
    }
}

bool FPuertsMixinAutomationEditorModule::TickPendingDeclarationRefresh(float DeltaTime)
{
    // 等待防抖窗口结束后再批量处理，避免连续保存重复生成
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    const double DebounceSeconds = Settings ? FMath::Max(0.1f, Settings->BlueprintSaveDebounceSeconds) : 1.0;

    if (FPlatformTime::Seconds() - LastBlueprintUpdateTime < DebounceSeconds)
    {
        return true;
    }

    FlushPendingDeclarationRefresh();
    TickerHandle.Reset();
    return false;
}

void FPuertsMixinAutomationEditorModule::FlushPendingDeclarationRefresh()
{
    // 先刷新 ue_bp.d.ts 等声明，再基于最新类型信息维护 Mixin 模板和索引
    if (!IDeclarationGenerator::IsAvailable())
    {
        PendingDeclarationSearchPaths.Reset();
        return;
    }

    TArray<FName> SearchPaths = PendingDeclarationSearchPaths.Array();
    PendingDeclarationSearchPaths.Reset();

    for (const FName& SearchPath : SearchPaths)
    {
        IDeclarationGenerator::Get().GenTypeScriptDeclaration(false, SearchPath);
    }

    GenerateMissingMixinsAndIndex();
}

// ---------------------------------------------------------------------------
// Mixin 文件生成：扫描 Blueprint、调用 Node 模板脚本、维护索引
// ---------------------------------------------------------------------------

void FPuertsMixinAutomationEditorModule::GenerateMissingMixinsAndIndex()
{
    const int32 CreatedCount = GenerateMissingMixinFiles();
    EnsureMixinRegisterFile();
    RunBlueprintCatalogGenerator();
    GenerateMixinIndex();

    UE_LOG(LogTemp, Display, TEXT("PuertsMixinAutomation generated %d missing mixin file(s)."), CreatedCount);
}

/** 按 AutoCreateMixinPolicy 扫描 Blueprint 资产，为缺失项创建 Mixin 文件 */
int32 FPuertsMixinAutomationEditorModule::GenerateMissingMixinFiles() const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return 0;
    }

    const FString BlueprintRootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    FString ScanRootPath;
    if (!TryGetAutoCreateScanRoot(Settings, ScanRootPath))
    {
        return 0;
    }

    // ScriptedBlueprintRootPath 必须是 BlueprintRootPath 的子路径
    if (!IsUnderAssetRoot(ScanRootPath, BlueprintRootPath))
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation ScriptedBlueprintRootPath must be under BlueprintRootPath: %s"),
            *ScanRootPath);
        return 0;
    }

    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();

    // 同步扫描确保刚保存/导入的 Blueprint 已进入资产注册表
    TArray<FString> PathsToScan;
    PathsToScan.Add(ScanRootPath);
    AssetRegistry.ScanPathsSynchronous(PathsToScan, true);

    FARFilter Filter;
    Filter.PackagePaths.Add(*ScanRootPath);
    Filter.bRecursivePaths = true;
    Filter.bRecursiveClasses = true;
#if ENGINE_MAJOR_VERSION >= 5
    Filter.ClassPaths.Add(UBlueprint::StaticClass()->GetClassPathName());
#else
    Filter.ClassNames.Add(UBlueprint::StaticClass()->GetFName());
#endif

    TArray<FAssetData> BlueprintAssets;
    AssetRegistry.GetAssets(Filter, BlueprintAssets);

    int32 CreatedCount = 0;
    for (const FAssetData& AssetData : BlueprintAssets)
    {
        if (!IsPuertsMixinSupportedBlueprintAsset(AssetData))
        {
            continue;
        }

        if (CreateMixinFileForBlueprintPackage(AssetData.PackageName.ToString(), !Settings->bCreateOnlyMissingMixins)
            == EMixinCreateResult::CreatedOrUpdated)
        {
            ++CreatedCount;
        }
    }

    return CreatedCount;
}

/**
 * 为单个 Blueprint 包创建对应的 Mixin .ts 文件。
 * 输出路径：MixinSourceRoot + 相对 BlueprintRootPath 的包路径（如 Actors/BP_Test.ts）
 */
FPuertsMixinAutomationEditorModule::EMixinCreateResult
FPuertsMixinAutomationEditorModule::CreateMixinFileForBlueprintPackage(
    const FString& BlueprintPackageName, bool bAllowOverwrite) const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return EMixinCreateResult::Failed;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    if (!IsUnderAssetRoot(BlueprintPackageName, RootPath))
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation Blueprint is outside BlueprintRootPath: %s"),
            *BlueprintPackageName);
        return EMixinCreateResult::Skipped;
    }

    const FString RelativePackagePath = MakeRelativePackagePath(BlueprintPackageName, RootPath);
    if (RelativePackagePath.IsEmpty())
    {
        return EMixinCreateResult::Skipped;
    }

    const FString MixinRootAbsolute = ToProjectAbsolutePath(Settings->MixinSourceRoot);
    const FString MixinFileAbsolute = MixinRootAbsolute / (RelativePackagePath + TEXT(".ts"));
    if (!bAllowOverwrite && FPaths::FileExists(MixinFileAbsolute))
    {
        UE_LOG(LogTemp, Display, TEXT("PuertsMixinAutomation mixin already exists: %s"), *MixinFileAbsolute);
        return EMixinCreateResult::Skipped;
    }

    IFileManager::Get().MakeDirectory(*FPaths::GetPath(MixinFileAbsolute), true);
    if (RunMixinTemplateGenerator(BlueprintPackageName))
    {
        return EMixinCreateResult::CreatedOrUpdated;
    }

    UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation failed to generate mixin template for %s"),
        *BlueprintPackageName);
    return EMixinCreateResult::Failed;
}

/** 通过 Node 执行 generate-mixin-template.mjs，将 Blueprint 元数据写入 Mixin 源文件 */
bool FPuertsMixinAutomationEditorModule::RunMixinTemplateGenerator(const FString& BlueprintPackageName) const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return false;
    }

    const FString ScriptAbsolute = ToProjectAbsolutePath(Settings->MixinTemplateScriptPath);
    if (!FPaths::FileExists(ScriptAbsolute))
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation template script not found: %s"), *ScriptAbsolute);
        return false;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString ProjectDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir());
    const FString Params = FString::Printf(
        TEXT("\"%s\" --project=\"%s\" --blueprint=\"%s\" --blueprint-root=\"%s\" --mixin-root=\"%s\" --manifest=\"%s\" --catalog=\"%s\""),
        *ScriptAbsolute,
        *ProjectDir,
        *BlueprintPackageName,
        *RootPath,
        *NormalizeProjectRelativePath(Settings->MixinSourceRoot),
        *NormalizeProjectRelativePath(Settings->BlueprintManifestPath),
        *NormalizeProjectRelativePath(Settings->BlueprintCatalogPath));

    int32 ReturnCode = INDEX_NONE;
    FString StdOut;
    FString StdErr;
    if (!FPlatformProcess::ExecProcess(*Settings->NodeExecutablePath, *Params, &ReturnCode, &StdOut, &StdErr))
    {
        UE_LOG(LogTemp, Warning,
            TEXT("PuertsMixinAutomation failed to launch %s. Ensure Node.js is on PATH or configure NodeExecutablePath."),
            *Settings->NodeExecutablePath);
        return false;
    }

    if (ReturnCode != 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation mixin template script failed for %s (exit %d). %s%s"),
            *BlueprintPackageName, ReturnCode, *StdOut, *StdErr);
        return false;
    }

    return true;
}

/** 通过 Node 执行 generate-blueprint-catalog.mjs，同步 Manifest / Catalog 并可处理重命名 */
bool FPuertsMixinAutomationEditorModule::RunBlueprintCatalogGenerator(const FString& ExtraArgs) const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return false;
    }

    const FString ScriptAbsolute = ToProjectAbsolutePath(Settings->BlueprintCatalogScriptPath);
    if (!FPaths::FileExists(ScriptAbsolute))
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation catalog script not found: %s"), *ScriptAbsolute);
        return false;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString ProjectDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir());
    const FString Params = FString::Printf(
        TEXT("\"%s\" --project=\"%s\" --blueprint-root=\"%s\" --mixin-root=\"%s\" --manifest=\"%s\" --catalog=\"%s\" %s"),
        *ScriptAbsolute,
        *ProjectDir,
        *RootPath,
        *NormalizeProjectRelativePath(Settings->MixinSourceRoot),
        *NormalizeProjectRelativePath(Settings->BlueprintManifestPath),
        *NormalizeProjectRelativePath(Settings->BlueprintCatalogPath),
        *ExtraArgs);

    int32 ReturnCode = INDEX_NONE;
    FString StdOut;
    FString StdErr;
    if (!FPlatformProcess::ExecProcess(*Settings->NodeExecutablePath, *Params, &ReturnCode, &StdOut, &StdErr))
    {
        UE_LOG(LogTemp, Warning,
            TEXT("PuertsMixinAutomation failed to launch %s. Ensure Node.js is on PATH or configure NodeExecutablePath."),
            *Settings->NodeExecutablePath);
        return false;
    }

    if (ReturnCode != 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation blueprint catalog script failed (exit %d). %s%s"),
            ReturnCode, *StdOut, *StdErr);
        return false;
    }

    return true;
}

/** 递归收集 MixinSourceRoot 下所有 .ts（排除 .d.ts），生成 mixin-imports.* 侧效 import 列表 */
void FPuertsMixinAutomationEditorModule::GenerateMixinIndex() const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return;
    }

    const FString ScriptAbsolute = ToProjectAbsolutePath(TEXT("Plugins/PuertsMixinAutomation/Scripts/generate-mixin-index.mjs"));
    if (!FPaths::FileExists(ScriptAbsolute))
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation mixin index script not found: %s"), *ScriptAbsolute);
        return;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString ProjectDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir());
    const FString Params = FString::Printf(
        TEXT("\"%s\" --project=\"%s\" --blueprint-root=\"%s\" --mixin-root=\"%s\" --manifest=\"%s\" --catalog=\"%s\" --index=\"%s\""),
        *ScriptAbsolute,
        *ProjectDir,
        *RootPath,
        *NormalizeProjectRelativePath(Settings->MixinSourceRoot),
        *NormalizeProjectRelativePath(Settings->BlueprintManifestPath),
        *NormalizeProjectRelativePath(Settings->BlueprintCatalogPath),
        *NormalizeProjectRelativePath(Settings->MixinIndexPath));

    int32 ReturnCode = INDEX_NONE;
    FString StdOut;
    FString StdErr;
    if (!FPlatformProcess::ExecProcess(*Settings->NodeExecutablePath, *Params, &ReturnCode, &StdOut, &StdErr))
    {
        UE_LOG(LogTemp, Warning,
            TEXT("PuertsMixinAutomation failed to launch %s. Ensure Node.js is on PATH or configure NodeExecutablePath."),
            *Settings->NodeExecutablePath);
        return;
    }

    if (ReturnCode != 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation mixin index script failed (exit %d). %s%s"),
            ReturnCode, *StdOut, *StdErr);
    }
}

/** 首次运行时创建 register.ts，仅 import mixin-imports.ts，供游戏启动时统一加载 mixin */
void FPuertsMixinAutomationEditorModule::EnsureMixinRegisterFile() const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return;
    }

    const FString RegisterFileAbsolute = ToProjectAbsolutePath(Settings->MixinRegisterPath);
    // 已存在则不覆盖，避免破坏用户自定义的注册逻辑
    if (FPaths::FileExists(RegisterFileAbsolute))
    {
        return;
    }

    const FString RegisterDirectory = FPaths::GetPath(RegisterFileAbsolute);
    const FString IndexFileAbsolute = ToProjectAbsolutePath(Settings->MixinIndexPath);
    FString ImportPath = MakeImportPath(RegisterDirectory, IndexFileAbsolute);

    FString RegisterSource;
    RegisterSource += TEXT("// Loads all generated Puerts Blueprint mixins.\n");
    RegisterSource += FString::Printf(TEXT("import \"%s\";\n"), *ImportPath);

    IFileManager::Get().MakeDirectory(*RegisterDirectory, true);
    FFileHelper::SaveStringToFile(RegisterSource, *RegisterFileAbsolute, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FPuertsMixinAutomationEditorModule, PuertsMixinAutomationEditor)
