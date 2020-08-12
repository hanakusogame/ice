import { MainScene } from "./MainScene";
declare function require(x: string): any;
// メインのゲーム画面
export class MainGame extends g.E {
	public reset: () => void;
	public finish: () => void;
	public setMode: (num: number) => void;

	constructor(scene: MainScene) {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const tl = require("@akashic-extension/akashic-timeline");
		const timeline = new tl.Timeline(scene);
		super({ scene: scene, x: 0, y: 0, width: 640, height: 360 });

		const bg = new g.FilledRect({
			scene: scene,
			width: g.game.width,
			height: g.game.height,
			cssColor: "white",
			opacity: 0.5,
		});
		this.append(bg);

		//マップ
		const mapBase = new g.FilledRect({
			scene: scene,
			x: 60,
			y: 5,
			width: 320,
			height: 360,
			touchable: true,
			cssColor: "white",
		});
		this.append(mapBase);

		const mapRow = 4;
		const mapColumn = 8;
		const maps: Map[][] = [];
		for (let x = 0; x < mapRow; x++) {
			maps[x] = [];
			for (let y = 0; y < mapColumn + 1; y++) {
				const w = mapBase.width / mapRow;
				const h = 320 / mapColumn;
				maps[x][y] = new Map(scene, w * x, h * y, w - 1, h - 1);
				mapBase.append(maps[x][y]);
				maps[x][y].num = y !== mapColumn ? -1 : 4;
			}
		}

		//枠線(左右)
		for (let x = 0; x < 2; x++) {
			const line = new g.Sprite({
				scene: scene,
				src: scene.assets.line,
				x: x * 380,
			});
			this.append(line);
		}

		//消えた数表示用
		const labels: g.Label[] = [];
		for (let i = 0; i < 2; i++) {
			const label = new g.Label({
				scene: scene,
				font: scene.numFontP,
				fontSize: 72,
				text: "0",
			});
			labels.push(label);
		}

		// つぎ
		this.append(
			new g.Sprite({
				scene: scene,
				src: scene.assets.score,
				x: 450,
				y: 100,
				height: 32,
				srcY: 64,
			})
		);

		//詰みライン
		mapBase.append(
			new g.FilledRect({
				scene: scene,
				x: 0,
				y: 320 / mapColumn,
				width: 320,
				height: 2,
				cssColor: "red",
			})
		);

		//コーン
		for (let i = 0; i < mapRow; i++) {
			const map = maps[i][mapColumn];
			const block = new Block({
				scene: scene,
				width: mapBase.width / mapRow - 2,
				height: mapBase.height / mapColumn - 2,
				x: map.x,
				y: map.y,
			});
			mapBase.append(block);
			map.block = block;
			block.setColor(5);
		}

		//ブロック
		const blocks: Block[] = [];
		for (let i = 0; i < mapRow * mapColumn; i++) {
			const block = new Block({
				scene: scene,
				width: mapBase.width / mapRow,
				height: mapBase.height / mapColumn,
			});
			blocks.push(block);
		}

		//列入れ替え
		const swap: (x: number, mx: number) => void = (x, mx) => {
			//移動中のブロックが邪魔している時は入れ替えない
			for (let i = mapColumn - 1; i >= 0; i--) {
				const mapA = maps[x][i];
				const mapB = maps[x + mx][i];
				if ((mapA.isMoveBlock && mapB.block) || (mapA.block && mapB.isMoveBlock)) {
					return;
				}
			}

			for (let i = mapColumn; i >= 0; i--) {
				const mapA = maps[x][i];
				const mapB = maps[x + mx][i];

				if (!mapA.block && !mapB.block) break;

				//入れ替え
				const bkBlock = mapA.block;
				mapA.block = mapB.block;
				mapB.block = bkBlock;

				//位置入れ替えるアニメーション
				[mapA, mapB].forEach((map) => {
					if (map.block) {
						timeline
							.create(map.block)
							.wait((mapColumn - i) * 30)
							.moveTo(map.x, map.y, 200);
					}
				});
			}
		};

		let px = 0;
		mapBase.pointDown.add((ev) => {
			px = Math.floor(ev.point.x / (mapBase.width / mapRow));
		});

		mapBase.pointMove.add((ev) => {
			if (px === -1 || isStop !== 0 || !scene.isStart) return;
			const x = Math.floor((ev.point.x + ev.startDelta.x) / (mapBase.width / mapRow));
			if (x !== px && x >= 0 && x < mapRow) {
				if (x < px) {
					swap(px, -1);
				} else {
					swap(px, 1);
				}
				px = -1;
			}
		});

		//次のブロックを出す
		let moveBlocks: Block[] = [];
		let nextBlocks: Block[] = [];
		const nextBlock: () => void = () => {
			nextBlocks.forEach((block) => {
				const map = maps[block.px][block.py];
				block.moveTo(map.x, map.y);
				mapBase.append(block);
				moveBlocks.push(block);
			});

			let bkNum = 0;
			for (let i = 0; i < 2; i++) {
				const block = blocks.pop();

				//同じ位置に２つ出ないようにするクソコード
				if (i === 0) {
					block.px = scene.random.get(0, 3);
					bkNum = block.px;
				} else {
					while (true) {
						block.px = scene.random.get(0, 3);
						if (bkNum !== block.px) break;
					}
				}

				block.py = 0;
				block.cnt = 0;
				block.moveTo(450 + i * 70, 150);
				block.setColor(scene.random.get(0, 4));
				this.append(block);
				nextBlocks[i] = block;
			}
		};

		//そろったブロックを消す
		const clearBlock: (x: number, y: number) => number = (x, y) => {
			let score = 0;

			if (y > mapColumn - 2) return score;

			const num = maps[x][y].block.colorNum;

			if (num === maps[x][y + 1].block.colorNum) return score;

			for (let i = y + 2; i < mapColumn; i++) {
				if (i !== y + 1 && maps[x][i].block.colorNum === num) {
					for (let j = y; j <= i; j++) {
						const block = maps[x][j].block;
						block.put();
					}

					const label = labels.pop();
					label.x = maps[x][y].x + 10;
					label.y = maps[x][y + 1].y;
					label.text = "" + (i - y + 1);
					label.invalidate();
					mapBase.append(label);

					timeline
						.create(label)
						.moveBy(0, -30, 500)
						.call(() => {
							label.remove();
							labels.push(label);
						});

					isStop++;
					timeline
						.create()
						.wait(500)
						.call(() => {
							for (let j = y; j <= i; j++) {
								const block = maps[x][j].block;
								blocks.unshift(block);
								block.remove();
								maps[x][j].block = null;
							}
							isStop--;
						});

					score = Math.pow(i - y, 3) * 60;
					break;
				}
			}

			return score;
		};

		//詰みの判定
		const checkMate: () => boolean = () => {
			for (let x = 0; x < mapRow; x++) {
				if (maps[x][0].block) return true;
			}
			return false;
		};

		// メインループ
		let isStop: number = 0; //消える処理の最中は動かせなくするためのフラグ
		let score = 0; //加算するスコア
		mapBase.update.add(() => {
			if (!scene.isStart) return;
			// ブロックを落とす
			moveBlocks = moveBlocks.filter((block) => {
				if (!block) return;
				// const time = (mapColumn - block.py) * 3;
				let time = 5;
				if (block.cnt > 30 && block.cnt % time === time - 1) {
					maps[block.px][block.py].isMoveBlock = false;
					const map = maps[block.px][block.py + 1];
					if (!map.block) {
						timeline.create(block).moveTo(map.x, map.y, (time / 30) * 1000);
						block.py++;
						map.isMoveBlock = true;
					} else {
						// ブロック配置
						maps[block.px][block.py].block = block;
						block.put();

						// 消える処理
						score += clearBlock(block.px, block.py);

						scene.playSound("se_move");

						return false;
					}
				}
				block.cnt++;
				return true;
			});

			if (moveBlocks.length === 0 && isStop === 0) {
				if (score > 0) {
					scene.addScore(score);
					scene.playSound("se_hit");
				}
				score = 0;

				//詰みの判定
				if (!checkMate()) {
					//次のブロックを出す
					nextBlock();
				} else {
					this.reset();
				}
			}
		});

		// 終了
		this.finish = () => {
			if (score > 0) scene.addScore(score);//加算されていないスコアを入れる
			return;
		};

		// リセット
		this.reset = () => {
			//マップのクリア
			for (let x = 0; x < mapRow; x++) {
				for (let y = 0; y < mapColumn; y++) {
					const map = maps[x][y];
					if (map.block) {
						blocks.unshift(map.block);
						map.block.remove();
						map.block = null;
					}
					map.isMoveBlock = false;
				}
			}

			//移動中のブロックのクリア
			moveBlocks.forEach((block) => {
				blocks.unshift(block);
				block.remove();
			});
			moveBlocks.length = 0;

			nextBlocks.forEach((block) => {
				blocks.unshift(block);
				block.remove();
			});
			nextBlocks.length = 0;

			score = 0;
			isStop = 0;

			nextBlock();
			nextBlock();
			return;
		};
	}
}

//マップクラス
class Map extends g.FilledRect {
	public num = 0;
	public block: Block = null;
	public isMoveBlock = false;

	constructor(scene: g.Scene, x: number, y: number, w: number, h: number) {
		super({
			scene: scene,
			x: x,
			y: y,
			width: w,
			height: h,
			cssColor: "#CCFFFF",
		});
	}
}

//ブロッククラス
class Block extends g.E {
	public cnt = 0;
	public px = 0;
	public py = 0;
	public colorNum = 0;
	//public colors = ["green", "red", "blue", "yellow", "pink"];
	public setColor: (num: number) => void;
	public put: () => void;

	constructor(pram: g.EParameterObject) {
		super(pram);

		const size = 60;
		const spr = new g.FrameSprite({
			scene: pram.scene,
			src: pram.scene.assets.ice as g.ImageAsset,
			width: size,
			height: size,
			x: (this.width - size) / 2,
			y: (this.height - size) / 2,
			frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
			frameNumber: 0,
		});
		this.append(spr);

		this.setColor = (num) => {
			this.colorNum = num;
			spr.frameNumber = num;
			spr.modified();
		};

		//乗せる
		this.put = () => {
			spr.frameNumber += 6;
			spr.modified();
		};
	}
}
