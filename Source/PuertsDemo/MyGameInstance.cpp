// Fill out your copyright notice in the Description page of Project Settings.

#include "MyGameInstance.h"

#include "PuertsScriptHostSubsystem.h"

void UMyGameInstance::Init()
{
    Super::Init();
}

void UMyGameInstance::OnStart()
{
    Super::OnStart();

    if (UPuertsScriptHostSubsystem* ScriptHost = GetSubsystem<UPuertsScriptHostSubsystem>())
    {
        ScriptHost->StartScripts();
    }
}

void UMyGameInstance::Shutdown()
{
    // 脚本 stop/dispose 由 UPuertsScriptHostSubsystem::Deinitialize 触发, 此处无需 Reset JsEnv.
    Super::Shutdown();
}
