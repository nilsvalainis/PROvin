/** HTML id un #anotācija pasūtījuma formai vienas lapas plūsmā */
export const ORDER_SECTION_ID = "pasutit" as const;

/** Sākumlapas hero `OrderForm` — jāsakrīt ar `formId` un pogas `getElementById`. */
export const HOME_HERO_ORDER_FORM_ID = "home-hero-order-form" as const;

/**
 * Hero ar `md:hidden` + `md:grid` zariem — divas `OrderForm` instances; katram savs id,
 * lai desktop poga neizsauktu `requestSubmit` uz paslēpto mobilā zara formu.
 */
export const HOME_HERO_ORDER_FORM_ID_SM = "home-hero-order-form-sm" as const;
export const HOME_HERO_ORDER_FORM_ID_MD = "home-hero-order-form-md" as const;
