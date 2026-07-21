import { z } from "zod";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Strong password policy: 10+ chars, upper, lower, number.
export const passwordSchema = z
  .string()
  .min(10, "Heslo musí mať aspoň 10 znakov.")
  // Cap the length: Argon2id memory/CPU cost scales with the input, so an
  // unbounded password is a cheap DoS vector against the login/register path.
  .max(128, "Heslo môže mať najviac 128 znakov.")
  .regex(/[A-Z]/, "Heslo musí obsahovať veľké písmeno.")
  .regex(/[a-z]/, "Heslo musí obsahovať malé písmeno.")
  .regex(/[0-9]/, "Heslo musí obsahovať číslicu.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(EMAIL_RE, "Neplatný email.");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Zadajte meno.").max(80),
  email: emailSchema,
  password: passwordSchema,
  consent: z
    .boolean()
    .refine((v) => v === true, "Musíte súhlasiť s podmienkami."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

// Self-service password change (customers + staff). The current password is
// verified server-side; the new one must meet the full password policy.
export const changePasswordSchema = z.object({
  current: z.string().min(1, "Zadajte súčasné heslo.").max(200),
  next: passwordSchema,
});

export const addressSchema = z.object({
  street: z.string().trim().max(120),
  houseNumber: z.string().trim().max(20),
  city: z.string().trim().max(120),
  zip: z.string().trim().max(20),
});

export const cartLineSchema = z.object({
  lineId: z.string().max(40),
  productId: z.string().max(80),
  restaurantId: z.string().max(40),
  name: z.string().max(120),
  image: z.string().max(400),
  sizeId: z.string().max(40),
  sizeLabel: z.string().max(40),
  unitPrice: z.number().nonnegative().max(1000),
  quantity: z.number().int().min(1).max(50),
  extraCheese: z.boolean(),
  stuffedCrust: z.boolean(),
  addedIngredients: z.array(z.string().max(60)).max(20),
  removedIngredients: z.array(z.string().max(60)).max(20),
  note: z.string().max(300).optional(),
  polpol: z.boolean().optional(), // half-and-half pizza — must survive so the
  // surcharge is applied and the kitchen sees it
});

export const orderInputSchema = z.object({
  restaurantId: z.enum(["pyro", "polomarik"]),
  fulfillment: z.enum(["delivery", "pickup"]),
  customerName: z.string().trim().min(2, "Zadajte meno.").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Zadajte telefón.")
    .max(30)
    .regex(/^[+0-9 ()-]+$/, "Neplatný telefón."),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  address: addressSchema.optional(),
  zoneName: z.string().max(80).optional(),
  lines: z.array(cartLineSchema).min(1, "Košík je prázdny.").max(60),
  couponCode: z.string().max(40).optional().nullable(),
  note: z.string().max(300).optional(),
  payment: z
    .enum(["cash_delivery", "card_delivery", "cash_pickup", "card_pickup"])
    .optional(),
});

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Neplatné údaje.";
}
