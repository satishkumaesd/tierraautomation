import { SceneData } from './scene';
import { buildPCB } from './pcb';
import { buildFactory } from './factory';

export function buildWorld(low: boolean): SceneData {
  const s = new SceneData();
  buildPCB(s, low);
  buildFactory(s, low);
  return s;
}
