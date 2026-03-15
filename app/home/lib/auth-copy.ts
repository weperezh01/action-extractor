import type { Lang } from '@/app/home/lib/i18n'

const authCopy = {
  en: {
    pageSignInTitle: 'Sign in',
    pageSignInSubtitle: 'Access your saved extractions, exports, and workspace history.',
    pageRegisterTitle: 'Create your account',
    pageRegisterSubtitle: 'Start saving, exporting, and organizing every extraction in one place.',
    panelLoginTitle: 'Access your workspace',
    panelRegisterTitle: 'Create your account',
    panelSubtitle: 'Save your extractions, export results, and keep your work organized.',
    resetSuccessTitle: 'Password updated',
    resetSuccessBody: 'Your password has been reset successfully.',
    signInCta: 'Sign in',
    newPasswordTitle: 'New password',
    newPasswordBody: 'Set a new password for your account.',
    newPasswordLabel: 'New password',
    confirmPasswordLabel: 'Confirm password',
    passwordMin: 'Minimum 8 characters',
    repeatPassword: 'Repeat password',
    resetSaving: 'Saving...',
    resetSubmit: 'Reset password',
    forgotSuccessTitle: 'Check your email',
    forgotSuccessBody:
      'If the email is registered, we will send you a link to reset your password.',
    backToSignIn: 'Back to sign in',
    forgotTitle: 'Reset password',
    forgotBody: 'We will send you a secure link to update your password.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    forgotSending: 'Sending...',
    forgotSendLink: 'Send link',
    loginTab: 'Sign in',
    registerTab: 'Create account',
    googleConnecting: 'Connecting to Google...',
    googleCreate: 'Create account with Google',
    googleContinue: 'Continue with Google',
    orWithEmail: 'or with email',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    passwordLabel: 'Password',
    authProcessing: 'Processing...',
    loginSubmit: 'Sign in',
    registerSubmit: 'Create account',
    forgotPassword: 'Forgot your password?',
    messages: {
      emailVerifiedSuccess: 'Email verified successfully. You can now sign in.',
      emailVerifiedExpired:
        'The verification link expired. Sign up again to receive a new email.',
      emailVerifiedInvalid: 'The verification link is invalid or has already been used.',
      emailVerifiedUnknown: 'We could not verify your email. Please try again.',
      googleSuccess: 'Signed in with Google successfully.',
      googleSuccessGlobal: 'Signed in with Google.',
      googleBlocked: 'Your account is temporarily blocked. Contact the administrator.',
      googleNotConfigured: 'Google OAuth is not configured on the server.',
      googleCancelled: 'Google authorization was cancelled.',
      googleInvalidState: 'We could not validate the Google session. Please try again.',
      googleError: 'We could not sign you in with Google. Please try again.',
      genericOperationError: 'We could not complete the request.',
      registerSuccess: 'Account created. Check your email to verify it before signing in.',
      invalidServerResponse: 'Invalid server response. Please try again.',
      connectionRetry: 'Connection error. Please try again.',
      forgotEmailError: 'We could not send the email. Please try again.',
      passwordsMismatch: 'Passwords do not match.',
      resetPasswordError: 'We could not reset your password.',
    },
  },
  es: {
    pageSignInTitle: 'Inicia sesión',
    pageSignInSubtitle: 'Accede a tus extracciones guardadas, exportaciones e historial de trabajo.',
    pageRegisterTitle: 'Crea tu cuenta',
    pageRegisterSubtitle:
      'Empieza a guardar, exportar y organizar cada extracción en un solo lugar.',
    panelLoginTitle: 'Accede a tu espacio',
    panelRegisterTitle: 'Crea tu cuenta',
    panelSubtitle: 'Guarda tus extracciones, exporta resultados y mantén tu trabajo organizado.',
    resetSuccessTitle: 'Contraseña actualizada',
    resetSuccessBody: 'Tu contraseña fue restablecida correctamente.',
    signInCta: 'Iniciar sesión',
    newPasswordTitle: 'Nueva contraseña',
    newPasswordBody: 'Define una contraseña nueva para tu cuenta.',
    newPasswordLabel: 'Nueva contraseña',
    confirmPasswordLabel: 'Confirmar contraseña',
    passwordMin: 'Mínimo 8 caracteres',
    repeatPassword: 'Repite la contraseña',
    resetSaving: 'Guardando...',
    resetSubmit: 'Restablecer contraseña',
    forgotSuccessTitle: 'Revisa tu correo',
    forgotSuccessBody:
      'Si el correo está registrado, te enviaremos un enlace para restablecer tu contraseña.',
    backToSignIn: 'Volver a iniciar sesión',
    forgotTitle: 'Recuperar contraseña',
    forgotBody: 'Te enviaremos un enlace seguro para actualizar tu contraseña.',
    emailLabel: 'Correo',
    emailPlaceholder: 'tu@correo.com',
    forgotSending: 'Enviando...',
    forgotSendLink: 'Enviar enlace',
    loginTab: 'Iniciar sesión',
    registerTab: 'Crear cuenta',
    googleConnecting: 'Conectando con Google...',
    googleCreate: 'Crear cuenta con Google',
    googleContinue: 'Continuar con Google',
    orWithEmail: 'o con correo',
    nameLabel: 'Nombre',
    namePlaceholder: 'Tu nombre',
    passwordLabel: 'Contraseña',
    authProcessing: 'Procesando...',
    loginSubmit: 'Entrar',
    registerSubmit: 'Crear cuenta',
    forgotPassword: '¿Olvidaste tu contraseña?',
    messages: {
      emailVerifiedSuccess: 'Correo verificado correctamente. Ya puedes iniciar sesión.',
      emailVerifiedExpired:
        'El enlace de verificación expiró. Regístrate nuevamente para recibir otro correo.',
      emailVerifiedInvalid: 'El enlace de verificación no es válido o ya fue utilizado.',
      emailVerifiedUnknown: 'No se pudo verificar tu correo. Intenta nuevamente.',
      googleSuccess: 'Sesión iniciada con Google correctamente.',
      googleSuccessGlobal: 'Sesión iniciada con Google.',
      googleBlocked: 'Tu cuenta está bloqueada temporalmente. Contacta al administrador.',
      googleNotConfigured: 'Google OAuth no está configurado en el servidor.',
      googleCancelled: 'Autorización con Google cancelada.',
      googleInvalidState: 'No se pudo validar la sesión de Google. Intenta nuevamente.',
      googleError: 'No se pudo iniciar sesión con Google. Intenta nuevamente.',
      genericOperationError: 'No se pudo completar la operación.',
      registerSuccess:
        'Cuenta creada. Revisa tu correo para verificar el email antes de iniciar sesión.',
      invalidServerResponse: 'Respuesta inválida del servidor. Intenta de nuevo.',
      connectionRetry: 'Error de conexión. Intenta de nuevo.',
      forgotEmailError: 'Error al enviar el correo. Intenta de nuevo.',
      passwordsMismatch: 'Las contraseñas no coinciden.',
      resetPasswordError: 'No se pudo restablecer la contraseña.',
    },
  },
} as const

const authServerMessageMap: Record<string, Record<Lang, string>> = {
  'Correo y contraseña son requeridos.': {
    en: 'Email and password are required.',
    es: 'Correo y contraseña son requeridos.',
  },
  'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.': {
    en: 'Too many sign-in attempts. Please try again in 15 minutes.',
    es: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
  },
  'Credenciales inválidas.': {
    en: 'Invalid credentials.',
    es: 'Credenciales inválidas.',
  },
  'Tu cuenta está bloqueada temporalmente. Contacta al administrador.': {
    en: 'Your account is temporarily blocked. Contact the administrator.',
    es: 'Tu cuenta está bloqueada temporalmente. Contacta al administrador.',
  },
  'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada y confirma el enlace.': {
    en: 'You must verify your email before signing in. Check your inbox and confirm the link.',
    es: 'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada y confirma el enlace.',
  },
  'No se pudo iniciar sesión.': {
    en: 'We could not sign you in.',
    es: 'No se pudo iniciar sesión.',
  },
  'Nombre inválido (mínimo 2 caracteres).': {
    en: 'Invalid name (minimum 2 characters).',
    es: 'Nombre inválido (mínimo 2 caracteres).',
  },
  'Correo electrónico inválido.': {
    en: 'Invalid email address.',
    es: 'Correo electrónico inválido.',
  },
  'La contraseña debe tener al menos 8 caracteres.': {
    en: 'Password must be at least 8 characters.',
    es: 'La contraseña debe tener al menos 8 caracteres.',
  },
  'Este correo ya está registrado.': {
    en: 'This email is already registered.',
    es: 'Este correo ya está registrado.',
  },
  'No se pudo actualizar el registro pendiente de verificación.': {
    en: 'We could not update the pending registration.',
    es: 'No se pudo actualizar el registro pendiente de verificación.',
  },
  'No se pudo enviar el correo de verificación. Intenta de nuevo.': {
    en: 'We could not send the verification email. Please try again.',
    es: 'No se pudo enviar el correo de verificación. Intenta de nuevo.',
  },
  'El servicio de correo no está disponible. Intenta más tarde.': {
    en: 'The email service is unavailable. Please try again later.',
    es: 'El servicio de correo no está disponible. Intenta más tarde.',
  },
  'Cuenta creada. Revisa tu correo para verificar el email antes de iniciar sesión.': {
    en: 'Account created. Check your email to verify it before signing in.',
    es: 'Cuenta creada. Revisa tu correo para verificar el email antes de iniciar sesión.',
  },
  'No se pudo registrar el usuario.': {
    en: 'We could not register the user.',
    es: 'No se pudo registrar el usuario.',
  },
  'No se pudo enviar el correo de recuperación. Intenta de nuevo.': {
    en: 'We could not send the recovery email. Please try again.',
    es: 'No se pudo enviar el correo de recuperación. Intenta de nuevo.',
  },
  'No se pudo procesar la solicitud.': {
    en: 'We could not process the request.',
    es: 'No se pudo procesar la solicitud.',
  },
  'Token inválido.': {
    en: 'Invalid token.',
    es: 'Token inválido.',
  },
  'El enlace es inválido o ya fue utilizado.': {
    en: 'The link is invalid or has already been used.',
    es: 'El enlace es inválido o ya fue utilizado.',
  },
  'El enlace expiró. Solicita uno nuevo desde el formulario de login.': {
    en: 'The link expired. Request a new one from the sign-in form.',
    es: 'El enlace expiró. Solicita uno nuevo desde el formulario de login.',
  },
  'No se pudo restablecer la contraseña.': {
    en: 'We could not reset the password.',
    es: 'No se pudo restablecer la contraseña.',
  },
}

export function getAuthCopy(lang: Lang) {
  return authCopy[lang]
}

export function translateAuthServerMessage(lang: Lang, message: string | null | undefined) {
  if (typeof message !== 'string') return null

  const normalized = message.trim()
  if (!normalized) return null

  return authServerMessageMap[normalized]?.[lang] ?? normalized
}
