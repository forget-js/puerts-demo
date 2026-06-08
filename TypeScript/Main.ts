/**
 * Puerts 脚本常驻入口.
 *
 * 仅调用 Bootstrap/startGame, 不写业务逻辑; 具体启动编排见 Bootstrap 层.
 */
import { startGame } from './Bootstrap/startGame';

startGame();
