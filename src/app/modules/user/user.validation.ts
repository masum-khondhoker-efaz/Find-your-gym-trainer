import z from 'zod';
const registerUser = z.object({
  body: z.object({
    fullName: z.string({
      required_error: 'Name is required!',
    }),
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    phoneNumber: z.string({
      required_error: 'Phone number is required!',
    }),
    password: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const sellerInfoSchema = z.object({
  body: z.object({
    companyName: z
      .string({
        required_error: 'Company name is required!',
      })
      .optional(),
    // logo: z
    //   .string({
    //     required_error: 'Logo is required!',
    //   })
    //   .optional(),
    companyEmail: z
      .string({
        required_error: 'Company email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    contactInfo: z
      .string({
        required_error: 'Contact info is required!',
      })
      .optional(),
    address: z
      .string({
        required_error: 'Address is required!',
      })
      .optional(),
    payoutInfo: z
      .string({
        required_error: 'Payout info is required!',
      })
      .optional(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    fullName: z
      .string({
        required_error: 'Name is required!',
      })
      .optional(),
    gender: z
      .string({
        required_error: 'Password is required!',
      })
      .optional(),
    phoneNumber: z
      .string({
        required_error: 'Phone number is required!',
      })
      .optional(),
    dateOfBirth: z
      .string({
        required_error: 'Date of birth is required!',
      })
      .optional(),

    address: z
      .string({
        required_error: 'Address is required!',
      })
      .optional(),
    companyName: z
      .string({
        required_error: 'Company name is required!',
      })
      .optional(),
    companyEmail: z
      .string({
        required_error: 'Company email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    // logo: z
    //   .string({
    //     required_error: 'Logo is required!',
    //   })
    //   .optional(),
    contactInfo: z
      .string({
        required_error: 'Contact info is required!',
      })
      .optional(),
    payoutInfo: z
      .string({
        required_error: 'Payout info is required!',
      })
      .optional(),
  }),
});

const updatePasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    password: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const forgetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    newPassword: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    otp: z.number({
      required_error: 'OTP is required!',
    }),
    otpToken: z.string({
      required_error: 'OTP token is required!',
    }),
  }),
});

const socialLoginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    fullName: z.string({
      required_error: 'name is required!',
    }),
    fcmToken: z.string({
      required_error: 'Fcm token is required!',
    }).optional(),
    phoneNumber: z
      .string({
        required_error: 'Phone number is required!',
      })
      .optional(),
    plateForm: z.enum(['GOOGLE', 'FACEBOOK', 'APPLE'], {
      required_error: 'PlatForm is required!',
    }),
    image: z.string().optional(),
    address: z.string().optional(),
  }),
});

const switchRoleSchema = z.object({
  body: z.object({
    role: z.enum(['BUYER', 'SELLER'], {
      required_error: 'Role is required!',
    }),
  }),
});

const updateAddressSchema = z.object({
  body: z.object({
    addressLine: z.string({
      required_error: 'Address is required!',
    }),
    city: z.string({
      required_error: 'City is required!',
    }),
    state: z
      .string({
        required_error: 'State is required!',
      })
      .optional(),
    postalCode: z
      .string({
        required_error: 'Postal code is required!',
      })
      .optional(),
    country: z
      .string({
        required_error: 'Country is required!',
      })
      .optional(),
  }),
});

export const UserValidations = {
  registerUser,
  sellerInfoSchema,
  updateProfileSchema,
  updatePasswordSchema,
  forgetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  socialLoginSchema,
  switchRoleSchema,
  updateAddressSchema,
};
