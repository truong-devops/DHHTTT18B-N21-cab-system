export const isValidPhone = (phone: string) => /^(0|\+84)\d{9,10}$/.test(phone)

export const isValidOtp = (otp: string) => /^\d{4,6}$/.test(otp)
