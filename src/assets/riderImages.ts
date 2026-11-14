import heroDogBiker from './images/hero_dog_biker_1794577255531.jpg';
import shibaAvatar from './images/rider_shiba_avatar_1794577256144.jpg';
import huskyAvatar from './images/rider_husky_avatar_1794577254857.jpg';
import bulldogAvatar from './images/rider_bulldog_avatar_1794577254901.jpg';
import gotVirtueAvatar from './images/rider_got_virtue_1794582806952.jpg';
import got66Avatar from './images/rider_got_66_1794582807646.jpg';
import oreoAvatar from './images/rider_oreo_1794618581178.jpg';
import aodeAvatar from './images/rider_aode_1794618747351.jpg';
import delsasAvatar from './images/rider_delsas_1794618946686.jpg';
import drusasAvatar from './images/rider_drusas_1794619108046.jpg';
import derekAvatar from './images/rider_derek_1794620200098.jpg';
import type { RiderId } from '../types/game';

export const HERO_IMAGE = heroDogBiker;

export const RIDER_AVATARS: Partial<Record<RiderId, string>> = {
  shiba: shibaAvatar,
  husky: huskyAvatar,
  bulldog: bulldogAvatar,
  got_virtue: gotVirtueAvatar,
  got_66: got66Avatar,
  oreo: oreoAvatar,
  aode: aodeAvatar,
  delsas: delsasAvatar,
  drusas: drusasAvatar,
  derek: derekAvatar,
};
