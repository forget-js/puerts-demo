#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "GameScriptHostGameInstance.generated.h"

/**
 * 可选的零自定义 C++ 接入方式.
 *
 * 在 DefaultEngine.ini 设置:
 *   GameInstanceClass=/Script/PuertsScriptHost.GameScriptHostGameInstance
 * 即可由插件自动在 OnStart 时启动 Puerts 脚本, 无需项目内编写 GameInstance 子类.
 */
UCLASS()
class PUERTSSCRIPTHOST_API UGameScriptHostGameInstance : public UGameInstance
{
    GENERATED_BODY()

public:
    virtual void OnStart() override;
};
