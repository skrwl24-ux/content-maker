export type JibssukApartmentImagePromptInput={
  title?:string;body?:string;mapEvidence?:string;autoMapEvidence?:string;priceEvidence?:string;
  lifestyleEvidence?:string;extraEvidence?:string;includeExtra?:boolean;
};
export type JibssukApartmentImagePrompt={
  slot:"00"|"01"|"02"|"03"|"04";label:string;purpose:string;
  sourceHint:string;evidenceEntered:boolean;prompt:string;
};
export declare const JIBSSUK_APARTMENT_IMAGE_SIZE:Readonly<{width:1600;height:900}>;
export declare const JIBSSUK_APARTMENT_IMAGE_SCENES:readonly Readonly<{
  slot:string;label:string;purpose:string;
}>[];
export declare function buildJibssukApartmentImagePrompts(
  input?:JibssukApartmentImagePromptInput
):JibssukApartmentImagePrompt[];
