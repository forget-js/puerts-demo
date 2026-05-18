#include "PuertsMixinAutomationEditorModule.h"

#include "AssetRegistry/IAssetRegistry.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "CodeGenerator.h"
#include "Components/ActorComponent.h"
#include "Engine/Blueprint.h"
#include "GameFramework/Actor.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformTime.h"
#include "IDeclarationGenerator.h"
#include "ISettingsModule.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "PathEscape.h"
#include "PuertsMixinAutomationSettings.h"

#define LOCTEXT_NAMESPACE "FPuertsMixinAutomationEditorModule"

namespace
{
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

FString ToProjectAbsolutePath(const FString& ProjectRelativePath)
{
    return FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / NormalizeProjectRelativePath(ProjectRelativePath));
}

bool IsUnderAssetRoot(const FString& PackageNameOrPath, const FString& RootPath)
{
    return PackageNameOrPath == RootPath || PackageNameOrPath.StartsWith(RootPath / TEXT(""));
}

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

FString MakeTypeScriptNamespace(const FString& PackageName)
{
    FString Trimmed = PackageName;
    while (Trimmed.StartsWith(TEXT("/")))
    {
        Trimmed.RightChopInline(1);
    }

    TArray<FString> Segments;
    Trimmed.ParseIntoArray(Segments, TEXT("/"), true);

    for (FString& Segment : Segments)
    {
        Segment = PUERTS_NAMESPACE::FilenameToTypeScriptVariableName(Segment);
    }

    return FString::Join(Segments, TEXT("."));
}

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

FString MakeLifecycleBody(const UClass* BlueprintClass)
{
    FString Body;

    if (BlueprintClass && BlueprintClass->IsChildOf(AActor::StaticClass()))
    {
        Body += TEXT("    ReceiveBeginPlay(): void {\n");
        Body += TEXT("    }\n\n");
        Body += TEXT("    ReceiveTick(DeltaSeconds: number): void {\n");
        Body += TEXT("    }\n");
    }
    else if (BlueprintClass && BlueprintClass->IsChildOf(UActorComponent::StaticClass()))
    {
        Body += TEXT("    ReceiveBeginPlay(): void {\n");
        Body += TEXT("    }\n\n");
        Body += TEXT("    ReceiveTick(DeltaSeconds: number): void {\n");
        Body += TEXT("    }\n");
    }
    else
    {
        Body += TEXT("    // Add Blueprint event overrides here.\n");
    }

    return Body;
}

FString BuildMixinSource(const FAssetData& AssetData, const UBlueprint* Blueprint)
{
    const FString PackageName = AssetData.PackageName.ToString();
    const FString AssetName = AssetData.AssetName.ToString();
    const FString ClassPath = FString::Printf(TEXT("%s.%s_C"), *PackageName, *AssetName);
    const FString TypePath = FString::Printf(TEXT("UE.%s.%s"),
        *MakeTypeScriptNamespace(PackageName), *PUERTS_NAMESPACE::FilenameToTypeScriptVariableName(AssetName + TEXT("_C")));
    const FString MixinClassName = PUERTS_NAMESPACE::FilenameToTypeScriptVariableName(AssetName + TEXT("Mixin"));
    const UClass* BlueprintClass = Blueprint ? Blueprint->GeneratedClass : nullptr;

    FString Source;
    Source += TEXT("import * as UE from 'ue';\n");
    Source += TEXT("import { blueprint } from 'puerts';\n\n");
    Source += FString::Printf(TEXT("const uclass = UE.Class.Load(\"%s\");\n"), *ClassPath);
    Source += FString::Printf(TEXT("const jsClass = blueprint.tojs<typeof %s>(uclass);\n\n"), *TypePath);
    Source += FString::Printf(TEXT("interface %s extends %s { }\n"), *MixinClassName, *TypePath);
    Source += FString::Printf(TEXT("class %s implements %s {\n"), *MixinClassName, *MixinClassName);
    Source += MakeLifecycleBody(BlueprintClass);
    Source += TEXT("}\n\n");
    Source += FString::Printf(TEXT("blueprint.mixin(jsClass, %s);\n"), *MixinClassName);

    return Source;
}

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

        UBlueprint* Blueprint = Cast<UBlueprint>(AssetData.GetAsset());
        if (!Blueprint || !Blueprint->GeneratedClass)
        {
            continue;
        }

        IFileManager::Get().MakeDirectory(*FPaths::GetPath(MixinFileAbsolute), true);
        if (FFileHelper::SaveStringToFile(
                BuildMixinSource(AssetData, Blueprint), *MixinFileAbsolute, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))
        {
            ++CreatedCount;
        }
    }

    return CreatedCount;
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
