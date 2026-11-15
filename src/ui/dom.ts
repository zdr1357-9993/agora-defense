/** id 로 요소를 가져오는 도우미 (main.ts 에서 분리, 동작 동일) */
export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
