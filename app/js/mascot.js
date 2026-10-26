// 돈구리(너구리) 마스코트. mascot(mood)는 상황별 그림의 <img> 태그를 돌려준다.
// 그림은 assets/mascot/<mood>.webp 에 있고, 캐릭터를 바꿀 때는 그 파일들만 교체하면 된다.
export const MOODS = ['calm', 'joy', 'surprise', 'rest', 'cheer', 'walk', 'think', 'front'];

export function mascot(mood = 'calm', size = 120, label = '돈구리') {
  const m = MOODS.includes(mood) ? mood : 'calm';
  const alt = label ? ` alt="${label}"` : ' alt="" aria-hidden="true"';
  return `<img class="mascot-img" src="assets/mascot/${m}.webp" width="${size}" height="${size}" style="width:auto;height:${size}px"${alt} decoding="async">`;
}
