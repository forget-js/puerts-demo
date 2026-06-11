#include "PuertsScriptHostDebuggerPort.h"

#include "Misc/CommandLine.h"
#include "Internationalization/Regex.h"

#if WITH_EDITOR
#include "Commandlets/Commandlet.h"
#endif

namespace FPuertsScriptHostDebuggerPort
{
    int32 Resolve(int32 DefaultPort)
    {
        int32 Result = -1;

#if WITH_EDITOR
        TArray<FString> OutTokens;
        TArray<FString> OutSwitches;
        TMap<FString, FString> OutParams;
        UCommandlet::ParseCommandLine(FCommandLine::Get(), OutTokens, OutSwitches, OutParams);

        static const auto GetPIEInstanceID = [](const TArray<FString>& InTokens) -> int32
        {
            static const int32 Start = FString{TEXT("PIEGameUserSettings")}.Len();
            static const int32 BaseCount = FString{TEXT("PIEGameUserSettings.ini")}.Len();

            const FString* TokenPtr = InTokens.FindByPredicate(
                [](const FString& InToken) { return InToken.StartsWith(TEXT("GameUserSettingsINI=")); });
            if (TokenPtr == nullptr)
            {
                return INDEX_NONE;
            }

            const FRegexPattern GameUserSettingsPattern{TEXT("PIEGameUserSettings[0-9]+\\.ini")};
            FRegexMatcher GameUserSettingsMatcher{GameUserSettingsPattern, *TokenPtr};
            if (GameUserSettingsMatcher.FindNext())
            {
                const FString GameUserSettingsFile = GameUserSettingsMatcher.GetCaptureGroup(0);
                return FCString::Atoi(*GameUserSettingsFile.Mid(Start, GameUserSettingsFile.Len() - BaseCount));
            }

            return INDEX_NONE;
        };

        const bool bPIEGame =
            OutSwitches.Find(TEXT("PIEVIACONSOLE")) != INDEX_NONE && OutSwitches.Find(TEXT("game")) != INDEX_NONE;
        if (bPIEGame)
        {
            const int32 Index = GetPIEInstanceID(OutTokens);
            if (OutSwitches.Find(TEXT("server")) != INDEX_NONE)
            {
                Result += 999;
            }
            else
            {
                Result += 10 * (Index + 1);
            }
        }

        static const FString DebugPortParam{TEXT("JsEnvDebugPort")};
        if (OutParams.Contains(DebugPortParam))
        {
            Result = FCString::Atoi(*OutParams[DebugPortParam]);
        }
#else
        if (FParse::Value(FCommandLine::Get(), TEXT("JsEnvDebugPort="), Result))
        {
            // 命令行显式指定完整端口.
        }
        else
        {
            Result = -1;
        }
#endif

        // 与 PuertsModule 一致: 无命令行/PIE 覆盖时回退 DefaultPort.
        return Result < 0 ? DefaultPort : Result;
    }
}
