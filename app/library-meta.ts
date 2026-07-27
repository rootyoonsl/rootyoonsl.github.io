type BookMeta = Readonly<{
  author: string;
  href: string;
  cover: string;
}>;

export const BOOKS = [
  {
    author: "앤디 위어",
    href: "https://product.kyobobook.co.kr/detail/S000000479333",
    cover: "https://image.yes24.com/goods/101375755/XL",
  },
  {
    author: "무라카미 하루키",
    href: "https://product.kyobobook.co.kr/detail/S000000777513",
    cover: "https://image.yes24.com/goods/3489078/XL",
  },
  {
    author: "무라카미 하루키",
    href: "https://product.kyobobook.co.kr/detail/S000000779889",
    cover: "https://image.yes24.com/goods/43306988/XL",
  },
  {
    author: "무라카미 하루키",
    href: "https://product.kyobobook.co.kr/detail/S000213398973",
    cover: "https://image.yes24.com/goods/126795598/XL",
  },
  {
    author: "무라카미 하루키",
    href: "https://product.kyobobook.co.kr/detail/S000208719388",
    cover: "https://image.yes24.com/goods/122090075/XL",
  },
  {
    author: "무라카미 하루키",
    href: "https://product.kyobobook.co.kr/detail/S000000620695",
    cover: "https://image.yes24.com/goods/91005341/XL",
  },
  {
    author: "히가시노 게이고",
    href: "https://product.kyobobook.co.kr/detail/S000001461135",
    cover: "https://image.yes24.com/goods/45353675/XL",
  },
  {
    author: "히가시노 게이고",
    href: "https://product.kyobobook.co.kr/detail/S000200550190",
    cover: "https://image.yes24.com/goods/116586056/XL",
  },
  {
    author: "매트 헤이그",
    href: "https://product.kyobobook.co.kr/detail/S000214820309",
    cover: "https://image.yes24.com/goods/139591308/XL",
  },
  {
    author: "매트 헤이그",
    href: "https://product.kyobobook.co.kr/detail/S000001947560",
    cover: "https://image.yes24.com/goods/99534783/XL",
  },
  {
    author: "매트 헤이그",
    href: "https://product.kyobobook.co.kr/detail/S000217295752",
    cover: "https://image.yes24.com/goods/151264277/XL",
  },
  {
    author: "그렉 이건",
    href: "https://product.kyobobook.co.kr/detail/S000200484667",
    cover: "https://image.yes24.com/goods/116414065/XL",
  },
  {
    author: "김초엽",
    href: "https://product.kyobobook.co.kr/detail/S000001953324",
    cover: "https://image.yes24.com/goods/103026125/XL",
  },
  {
    author: "김초엽",
    href: "https://product.kyobobook.co.kr/detail/S000001935245",
    cover: "https://image.yes24.com/goods/74261416/XL",
  },
  {
    author: "키키·프랭키",
    href: "https://product.kyobobook.co.kr/detail/S000219601134",
    cover: "https://image.yes24.com/goods/184453653/XL",
  },
  {
    author: "매튜 콥",
    href: "https://product.kyobobook.co.kr/detail/S000001744914",
    cover: "https://image.yes24.com/goods/103950272/XL",
  },
  {
    author: "무라카미 하루키",
    href: "https://product.kyobobook.co.kr/detail/S000001068777",
    cover: "https://image.yes24.com/goods/3239082/XL",
  },
  {
    author: "김주환",
    href: "https://product.kyobobook.co.kr/detail/S000201078049",
    cover: "https://image.yes24.com/goods/117643865/XL",
  },
  {
    author: "김민철",
    href: "https://product.kyobobook.co.kr/detail/S000219075303",
    cover: "https://image.yes24.com/goods/171569426/XL",
  },
  {
    author: "정두현",
    href: "https://product.kyobobook.co.kr/detail/S000216210544",
    cover: "https://image.yes24.com/goods/144444878/XL",
  },
  {
    author: "김상균",
    href: "https://product.kyobobook.co.kr/detail/S000219014147",
    cover: "https://image.yes24.com/goods/174200856/XL",
  },
  {
    author: "미치오 카쿠",
    href: "https://product.kyobobook.co.kr/detail/S000211612929",
    cover: "https://image.yes24.com/goods/124057844/XL",
  },
  {
    author: "채사장",
    href: "https://product.kyobobook.co.kr/detail/S000001938774",
    cover: "https://image.yes24.com/goods/86545658/XL",
  },
] as const satisfies readonly BookMeta[];

export const GITHUB_URL = "https://github.com/rootyoonsl" as const;
