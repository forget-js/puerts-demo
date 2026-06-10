/**
 * TestUser 域 REST API（Apifox 宠物商店用户接口）.
 *
 * Base URL 见 Config.http.baseUrl; 覆盖 POST/GET/PUT/DELETE /users 及 /users/{username}.
 */

import type { HttpTask } from '../../Runtime';
import type { ApiHttpDeps, ApiRequestOptions } from './api.deps';

/** TestUser 域 REST 路径（相对 Config.http.baseUrl） */
const TestUserRoutes = {
    users: '/users',
    user: (username: string) => `/users/${encodeURIComponent(username)}`,
} as const;

/** GET /users/{username} — 用户账号信息（Apifox User schema） */
export interface UserDto {
    readonly id?: number;
    readonly username?: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly email?: string;
    readonly password?: string;
    readonly phone?: string;
    /** 0: 正常, 1: 管理员, -1: 已封禁 */
    readonly userStatus?: number;
}

/** POST /users — 创建请求体 */
export type CreateUserRequestDto = Omit<UserDto, 'id'>;

/** PUT /users/{username} — 更新请求体 */
export type UpdateUserRequestDto = UserDto;

/** POST/PUT/DELETE 成功时 Apifox 返回空对象 */
export type EmptyResponseDto = Record<string, never>;

export interface TestUserApi {
    createUser(body: CreateUserRequestDto, options?: ApiRequestOptions): HttpTask<EmptyResponseDto>;
    getUserByName(username: string, options?: ApiRequestOptions): HttpTask<UserDto>;
    updateUser(username: string, body: UpdateUserRequestDto, options?: ApiRequestOptions): HttpTask<EmptyResponseDto>;
    deleteUser(username: string, options?: ApiRequestOptions): HttpTask<EmptyResponseDto>;
}

export function createTestUserApi(deps: ApiHttpDeps): TestUserApi {
    return {
        createUser: (body, options = {}) => deps.post<EmptyResponseDto>(TestUserRoutes.users, body, options),

        getUserByName: (username, options = {}) => deps.get<UserDto>(TestUserRoutes.user(username), options),

        updateUser: (username, body, options = {}) =>
            deps.put<EmptyResponseDto>(TestUserRoutes.user(username), body, options),

        deleteUser: (username, options = {}) => deps.delete<EmptyResponseDto>(TestUserRoutes.user(username), options),
    };
}

export { TestUserRoutes };
