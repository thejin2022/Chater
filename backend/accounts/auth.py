# Custom authentication that lets DRF JWTAuthentication read tokens from cookies
# Mapped from REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES in settings.py.
from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
  

    def enforce_csrf(self, request):

        csrf_check = CSRFCheck(lambda req: None)
        csrf_check.process_request(request)
        reason = csrf_check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
    
    def authenticate(self, request):
        """
        Read the JWT token from the HTTP request cookie and validate it.
        This is the cookie-based auth flow configured in REST_FRAMEWORK.
         - Success: return (user, validated_token)
         - Failure: return None
         - Note: do not raise exceptions here so DRF permission classes can handle auth failures
        """

        raw_token = request.COOKIES.get(settings.SIMPLE_JWT["AUTH_COOKIE"])
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        # Only methods that change data need CSRF validation.
        if request.method not in SAFE_METHODS:
            self.enforce_csrf(request)

        return user, validated_token
