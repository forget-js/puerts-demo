// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "MyGameInstance.generated.h"

/**
 * 项目 GameInstance: 仅转发脚本启动到 PuertsScriptHost 插件 Subsystem.
 * JsEnv 生命周期由 UPuertsScriptHostSubsystem 统一管理.
 */
UCLASS()
class PUERTSDEMO_API UMyGameInstance : public UGameInstance
{
    GENERATED_BODY()

public:
    virtual void Init() override;
    virtual void OnStart() override;
    virtual void Shutdown() override;
};
