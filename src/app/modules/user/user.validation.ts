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
    role: z.enum(['MEMBER', 'TRAINER'], {
      required_error: 'Role is required!',
    }),
  }),
});

const trainerRegisterUser = z.object({
  body: z.object({
    trainerSpecialty: z.array(
      z.string({
        required_error: 'Trainer specialty is required!',
      }),
    ),
    experienceYears: z
      .string({
        required_error: 'Experience years is required!',
      })
      .transform(val => Number(val)),
    trainerServiceType: z.array(
      z.string({
        required_error: 'Service type is required!',
      }),
    ),
  }),
});

const updateTrainerProfileSchema = z.object({
  body: z
    .object({
      trainerSpecialty: z
        .array(
          z.string({
            required_error: 'Trainer specialty is required!',
          }),
        )
        .optional(),
      experienceYears: z
        .string({
          required_error: 'Experience years is required!',
        })
        .transform(val => Number(val))
        .optional(),
      trainerServiceType: z
        .array(
          z.string({
            required_error: 'Service type is required!',
          }),
        )
        .optional(),
      orgName: z
        .string({
          required_error: 'Organization name is required!',
        })
        .optional(),
      credentialNo: z
        .string({
          required_error: 'Credential number is required!',
        })
        .optional(),
      gymName: z
        .string({
          required_error: 'Gym name is required!',
        })
        .optional(),
      gymAddress: z
        .string({
          required_error: 'Gym address is required!',
        })
        .optional(),
      googlePlaceId: z
        .string({
          required_error: 'Gym ID is required!',
        })
        .optional(),
      latitude: z
        .string({
          required_error: 'Latitude is required!',
        })
        .transform(val => Number(val))
        .optional(),
      longitude: z
        .string({
          required_error: 'Longitude is required!',
        })
        .transform(val => Number(val))
        .optional(),
    })
    .superRefine((data, ctx) => {
      const hasGymName = data.gymName !== undefined;
      const hasGymAddress = data.gymAddress !== undefined;
      const hasGooglePlaceId = data.googlePlaceId !== undefined;
      const hasLatitude = data.latitude !== undefined;
      const hasLongitude = data.longitude !== undefined;

      const hasAnyGymField =
        hasGymName || hasGymAddress || hasGooglePlaceId || hasLatitude || hasLongitude;
      const hasAllGymFields =
        hasGymName && hasGymAddress && hasGooglePlaceId && hasLatitude && hasLongitude;

      if (hasAnyGymField && !hasAllGymFields) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'gymName, gymAddress, googlePlaceId, latitude, and longitude must all be provided together.',
          path: ['gymName'],
        });
      }
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
    bio: z
      .string({
        required_error: 'Bio is required!',
      })
      .optional(),
    gymId: z
      .string({
        required_error: 'Gym ID is required!',
      })
      .optional(),
    gymName: z
      .string({
        required_error: 'Gym name is required!',
      })
      .optional(),
    // contactInfo: z
    //   .string({
    //     required_error: 'Contact info is required!',
    //   })
    //   .optional(),
    fitnessGoals: z
      .array(
        z.string({
          required_error: 'Fitness goals are required!',
        }),
      )
      .optional(),
    latitude: z
      .string({
        required_error: 'Latitude is required!',
      })
      .transform(val => Number(val))
      .optional(),
    longitude: z
      .string({
        required_error: 'Longitude is required!',
      })
      .transform(val => Number(val))
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
    otp: z.number({
      required_error: 'OTP is required!',
    }),
    otpToken: z.string({
      required_error: 'OTP token is required!',
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
    fcmToken: z
      .string({
        required_error: 'Fcm token is required!',
      })
      .optional(),
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
  updateProfileSchema,
  updatePasswordSchema,
  forgetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  socialLoginSchema,
  updateAddressSchema,
  trainerRegisterUser,
  updateTrainerProfileSchema,
};
