// Internal types for Translator 2.0

export type T2SemanticFrame = {
  subject: "I"|"you"|"he"|"she"|"we"|"they";
  verbRootId: string | null;
  tense: "present" | "past" | "future";
  neg: boolean; prog: boolean; hab: boolean; question: boolean;
  objects: string[]; // noun IDs
  particles: string[]; // mapped codes: ri/ith/ʌs/la
};

export type T2Result = {
  surface: string;
  variants: string[];
  analysis: Record<string, unknown>;
  warnings: string[];
};

export type T2Options = {
  particles?: Partial<Record<'WITH'|'TO'|'FROM'|'IN_AT', string>>;
  coordinators?: Partial<Record<'AND'|'OR'|'NOR'|'BUT', string>>;
  flags?: { enableCoordination?: boolean };
};

