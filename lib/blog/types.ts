export type BlogImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
};

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "callout"; text: string }
  | { type: "stats"; rows: { label: string; value: string }[] }
  | {
      type: "image";
      src: string;
      alt: string;
      width?: number;
      height?: number;
      caption?: string;
    };

export type BlogPostLocale = {
  title: string;
  excerpt: string;
  /** Sociālajiem / Open Graph — īss. */
  socialExcerpt?: string;
  body: BlogBlock[];
};

export type BlogPost = {
  slug: string;
  /** ISO date `YYYY-MM-DD` */
  publishedAt: string;
  category: string;
  tags: string[];
  /** Cover / Open Graph — SEO un saraksta thumbnail. */
  coverImage?: BlogImage;
  lv: BlogPostLocale;
  /** Ja nav — rādām LV ar atzīmi. */
  en?: BlogPostLocale;
};

export type BlogCommentPublic = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type BlogCommentAdmin = BlogCommentPublic & {
  hidden?: boolean;
};
