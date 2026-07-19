import { describe, it, expect } from "vitest";

import {
  updateProfileSchema,
  changePasswordSchema,
  createAddressSchema,
  updateAddressSchema,
  notificationPreferencesSchema,
} from "@/lib/validation";

describe("updateProfileSchema", () => {
  it("normalizes country/currency to uppercase", () => {
    const parsed = updateProfileSchema.parse({ country: "gb", currency: "gbp" });
    expect(parsed.country).toBe("GB");
    expect(parsed.currency).toBe("GBP");
  });

  it("accepts a valid E.164-ish phone", () => {
    expect(updateProfileSchema.safeParse({ phone: "+44 7700 900123" }).success).toBe(true);
  });

  it("rejects a garbage phone number", () => {
    expect(updateProfileSchema.safeParse({ phone: "not-a-phone!!" }).success).toBe(false);
  });

  it("rejects a country code that is not 2 letters", () => {
    expect(updateProfileSchema.safeParse({ country: "GBR" }).success).toBe(false);
  });

  it("rejects an empty object (nothing to update)", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it("allows clearing a field with an empty string", () => {
    expect(updateProfileSchema.safeParse({ phone: "" }).success).toBe(true);
  });
});

describe("changePasswordSchema", () => {
  it("accepts a strong, different new password", () => {
    const res = changePasswordSchema.safeParse({
      currentPassword: "OldPass123",
      newPassword: "NewPass456",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a weak new password", () => {
    const res = changePasswordSchema.safeParse({
      currentPassword: "OldPass123",
      newPassword: "weak",
    });
    expect(res.success).toBe(false);
  });

  it("rejects when new password equals current", () => {
    const res = changePasswordSchema.safeParse({
      currentPassword: "SamePass123",
      newPassword: "SamePass123",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.flatten().fieldErrors.newPassword?.[0]).toMatch(/different/i);
    }
  });

  it("rejects a missing current password", () => {
    const res = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "NewPass456",
    });
    expect(res.success).toBe(false);
  });
});

describe("createAddressSchema", () => {
  it("defaults isDefault to false and uppercases country", () => {
    const parsed = createAddressSchema.parse({
      line1: "1 Test St",
      city: "London",
      postalCode: "SW1A 1AA",
      country: "gb",
    });
    expect(parsed.isDefault).toBe(false);
    expect(parsed.country).toBe("GB");
  });

  it("rejects a missing required line1", () => {
    const res = createAddressSchema.safeParse({
      city: "London",
      postalCode: "SW1A 1AA",
      country: "GB",
    });
    expect(res.success).toBe(false);
  });
});

describe("updateAddressSchema", () => {
  it("accepts a single-field partial update", () => {
    expect(updateAddressSchema.safeParse({ city: "Leeds" }).success).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(updateAddressSchema.safeParse({}).success).toBe(false);
  });

  it("still validates provided fields (bad country code)", () => {
    expect(updateAddressSchema.safeParse({ country: "GBR" }).success).toBe(false);
  });
});

describe("notificationPreferencesSchema", () => {
  it("accepts a single toggle", () => {
    expect(notificationPreferencesSchema.safeParse({ emailMarketing: true }).success).toBe(true);
  });

  it("rejects an empty payload", () => {
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-boolean toggle", () => {
    expect(
      notificationPreferencesSchema.safeParse({ emailOrders: "yes" }).success
    ).toBe(false);
  });
});
