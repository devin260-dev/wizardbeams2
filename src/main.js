import { GameLoop } from './core/GameLoop.js';
import { InputManager } from './core/InputManager.js';
import { EventBus } from './core/EventBus.js';
import { SceneManager } from './core/SceneManager.js';
import { Renderer } from './rendering/Renderer.js';

// Screens
import { StartScreen } from './meta/StartScreen.js';
import { MapScreen } from './meta/MapScreen.js';
import { LoadoutScreen } from './meta/LoadoutScreen.js';
import { CombatScreen } from './combat/CombatScreen.js';
import { PostCombatScreen } from './meta/PostCombatScreen.js';
import { MerchantScreen } from './meta/MerchantScreen.js';
import { ShrineScreen } from './meta/ShrineScreen.js';
import { RestScreen } from './meta/RestScreen.js';
import { EventScreen } from './meta/EventScreen.js';
import { GameOverScreen } from './meta/GameOverScreen.js';

// Initialize canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Core systems
export const eventBus = new EventBus();
export const inputManager = new InputManager(canvas);
export const renderer = new Renderer(ctx);
export const gameLoop = new GameLoop(inputManager);
export const sceneManager = new SceneManager(gameLoop);

// Create and register all screens
sceneManager.register('start', new StartScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('map', new MapScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('loadout', new LoadoutScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('combat', new CombatScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('postcombat', new PostCombatScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('merchant', new MerchantScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('shrine', new ShrineScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('rest', new RestScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('event', new EventScreen(sceneManager, eventBus, inputManager, renderer));
sceneManager.register('gameover', new GameOverScreen(sceneManager, eventBus, inputManager, renderer));

// Start the game
sceneManager.changeScene('start');
gameLoop.start(ctx);
