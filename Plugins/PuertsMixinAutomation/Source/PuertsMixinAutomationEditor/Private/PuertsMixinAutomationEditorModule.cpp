#include "PuertsMixinAutomationEditorModule.h"

#include "AssetRegistry/IAssetRegistry.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "CodeGenerator.h"
#include "Engine/Blueprint.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformProcess.h"
#include "HAL/PlatformTime.h"
#include "IDeclarationGenerator.h"
#include "ISettingsModule.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "PuertsMixinAutomationSettings.h"

#define LOCTEXT_NAMESPACE "FPuertsMixinAutomationEditorModule"

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

/** 兼容 UE4/UE5 资产类名判断：是否为 Blueprint 资产 */
bool IsBlueprintAsset(const FAssetData& AssetData)
{
#if ENGINE_MAJOR_VERSION >= 5
    return AssetData.AssetClassPath == UBlueprint::StaticClass()->GetClassPathName();
#else
    return AssetData.AssetClass == UBlueprint::StaticClass()->GetFName();
#endif
}
}    // namespace

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
}

void FPuertsMixinAutomationEditorModule::ShutdownModule()
{
    UnregisterAssetCallbacks();
    UnregisterSettings();
}

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

void FPuertsMixinAutomationEditorModule::RegisterAssetCallbacks()
{
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    AssetUpdatedHandle = AssetRegistryModule.Get().OnAssetUpdated().AddRaw(this, &FPuertsMixinAutomationEditorModule::OnAssetUpdated);
}

void FPuertsMixinAutomationEditorModule::UnregisterAssetCallbacks()
{
    if (AssetUpdatedHandle.IsValid() && FModuleManager::Get().IsModuleLoaded("AssetRegistry"))
    {
        FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
        AssetRegistryModule.Get().OnAssetUpdated().Remove(AssetUpdatedHandle);
        AssetUpdatedHandle.Reset();
    }

    if (TickerHandle.IsValid())
    {
        FTSTicker::GetCoreTicker().RemoveTicker(TickerHandle);
        TickerHandle.Reset();
    }

    PendingDeclarationSearchPaths.Reset();
}

void FPuertsMixinAutomationEditorModule::OnAssetUpdated(const FAssetData& AssetData)
{
    // 仅处理配置根路径下的 Blueprint 保存事件
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings || !Settings->bGenerateOnBlueprintSave || !IsBlueprintAsset(AssetData))
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
    // 先刷新 ue_bp.d.ts 等声明，再基于最新类型信息生成 mixin
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

void FPuertsMixinAutomationEditorModule::GenerateMissingMixinsAndIndex()
{
    const int32 CreatedCount = GenerateMissingMixinFiles();
    EnsureMixinRegisterFile();
    GenerateMixinIndex();

    UE_LOG(LogTemp, Display, TEXT("PuertsMixinAutomation generated %d missing mixin file(s)."), CreatedCount);
}

int32 FPuertsMixinAutomationEditorModule::GenerateMissingMixinFiles() const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return 0;
    }

    const FString RootPath = NormalizeAssetRoot(Settings->BlueprintRootPath);
    const FString MixinRootAbsolute = ToProjectAbsolutePath(Settings->MixinSourceRoot);

    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();

    TArray<FString> PathsToScan;
    PathsToScan.Add(RootPath);
    AssetRegistry.ScanPathsSynchronous(PathsToScan, true);

    FARFilter Filter;
    Filter.PackagePaths.Add(*RootPath);
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
        const FString PackageName = AssetData.PackageName.ToString();
        const FString RelativePackagePath = MakeRelativePackagePath(PackageName, RootPath);
        if (RelativePackagePath.IsEmpty())
        {
            continue;
        }

        const FString MixinFileAbsolute = MixinRootAbsolute / (RelativePackagePath + TEXT(".ts"));
        if (Settings->bCreateOnlyMissingMixins && FPaths::FileExists(MixinFileAbsolute))
        {
            continue;
        }

        // 先创建空文件占位，再由 Node 脚本写入完整模板内容
        IFileManager::Get().MakeDirectory(*FPaths::GetPath(MixinFileAbsolute), true);
        if (!FFileHelper::SaveStringToFile(TEXT(""), *MixinFileAbsolute, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))
        {
            continue;
        }

        if (RunMixinTemplateGenerator(PackageName))
        {
            ++CreatedCount;
        }
        else
        {
            UE_LOG(LogTemp, Warning, TEXT("PuertsMixinAutomation failed to generate mixin template for %s"), *PackageName);
        }
    }

    return CreatedCount;
}

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
        TEXT("\"%s\" --project=\"%s\" --blueprint=\"%s\" --blueprint-root=\"%s\" --mixin-root=\"%s\""),
        *ScriptAbsolute,
        *ProjectDir,
        *BlueprintPackageName,
        *RootPath,
        *NormalizeProjectRelativePath(Settings->MixinSourceRoot));

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

void FPuertsMixinAutomationEditorModule::GenerateMixinIndex() const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return;
    }

    const FString MixinRootAbsolute = ToProjectAbsolutePath(Settings->MixinSourceRoot);
    const FString IndexFileAbsolute = ToProjectAbsolutePath(Settings->MixinIndexPath);
    const FString IndexDirectory = FPaths::GetPath(IndexFileAbsolute);

    TArray<FString> MixinFiles;
    IFileManager::Get().FindFilesRecursive(MixinFiles, *MixinRootAbsolute, TEXT("*.ts"), true, false);
    MixinFiles.RemoveAll([](const FString& FilePath) { return FilePath.EndsWith(TEXT(".d.ts")); });
    MixinFiles.Sort();

    FString IndexSource;
    IndexSource += TEXT("// Auto-generated by PuertsMixinAutomation. Do not edit.\n");
    for (const FString& MixinFile : MixinFiles)
    {
        IndexSource += FString::Printf(TEXT("import \"%s\";\n"), *MakeImportPath(IndexDirectory, MixinFile));
    }

    IFileManager::Get().MakeDirectory(*IndexDirectory, true);
    FFileHelper::SaveStringToFile(IndexSource, *IndexFileAbsolute, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

void FPuertsMixinAutomationEditorModule::EnsureMixinRegisterFile() const
{
    const UPuertsMixinAutomationSettings* Settings = GetDefault<UPuertsMixinAutomationSettings>();
    if (!Settings)
    {
        return;
    }

    const FString RegisterFileAbsolute = ToProjectAbsolutePath(Settings->MixinRegisterPath);
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
