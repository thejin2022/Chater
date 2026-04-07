from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer
from rest_framework.permissions import IsAuthenticated


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)




class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "username": request.user.username,
            "user_id": request.user.id,
        })




class CsrfTokenView(APIView):
    """
    Endpoint for the frontend to proactively fetch a CSRF cookie.
    The frontend can call this API before sending POST/PUT/PATCH/DELETE requests.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        token = get_token(request)
        return Response({
            "detail": "CSRF cookie set",
            "csrfToken": token,
        })





# Store tokens in HttpOnly cookies.
from rest_framework_simplejwt.views import TokenObtainPairView


def _cookie_settings(max_age: int) -> dict:
    return {
        "httponly": settings.SIMPLE_JWT["AUTH_COOKIE_HTTP_ONLY"],
        "secure": settings.SIMPLE_JWT["AUTH_COOKIE_SECURE"],
        "samesite": settings.SIMPLE_JWT["AUTH_COOKIE_SAMESITE"],
        "path": settings.SIMPLE_JWT["AUTH_COOKIE_PATH"],
        "max_age": max_age,
    }


def _set_auth_cookies(response: Response, access: str, refresh: str | None = None) -> None:
    response.set_cookie(
        key=settings.SIMPLE_JWT["AUTH_COOKIE"],
        value=access,
        **_cookie_settings(
            int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
        ),
    )

    if refresh:
        response.set_cookie(
            key=settings.SIMPLE_JWT["AUTH_COOKIE_REFRESH"],
            value=refresh,
            **_cookie_settings(
                int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
            ),
        )

class CookieTokenObtainPairView(TokenObtainPairView):
    """
    After a successful login:
    - Do not return access / refresh in the response body
    - Use HttpOnly cookies instead
    """

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        # SimpleJWT returns 401 if the credentials are invalid.
        if response.status_code != status.HTTP_200_OK:
            return response

        access = response.data.get("access")
        refresh = response.data.get("refresh")

        # Clear the body so the frontend cannot read the tokens directly.
        response.data = {"detail": "login success"}
        _set_auth_cookies(response, access=access, refresh=refresh)

        return response



# Refresh the access token when it expires by using the refresh token.
from rest_framework_simplejwt.views import TokenRefreshView


class CookieTokenRefreshView(TokenRefreshView):
    """
    Read the refresh token from the HttpOnly cookie
    and issue a new access token.
    """

    def post(self, request, *args, **kwargs):
        # Put the refresh token from the cookie back into request.data.
        refresh = request.COOKIES.get(settings.SIMPLE_JWT["AUTH_COOKIE_REFRESH"])
        if refresh:
            request._full_data = request.data.copy()
            request._full_data["refresh"] = refresh

        response = super().post(request, *args, **kwargs)

        if response.status_code != status.HTTP_200_OK:
            return response

        access = response.data.get("access")
        response.data = {"detail": "token refreshed"}
        _set_auth_cookies(response, access=access)

        return response


class LogoutView(APIView):
    """
    Clear auth cookies and end current cookie-based auth session.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        response = Response(
            {"detail": "logout success"},
            status=status.HTTP_200_OK,
        )

        cookie_kwargs = {
            "path": settings.SIMPLE_JWT["AUTH_COOKIE_PATH"],
            "samesite": settings.SIMPLE_JWT["AUTH_COOKIE_SAMESITE"],
        }
        response.delete_cookie(settings.SIMPLE_JWT["AUTH_COOKIE"], **cookie_kwargs)
        response.delete_cookie(settings.SIMPLE_JWT["AUTH_COOKIE_REFRESH"], **cookie_kwargs)
        response.delete_cookie(
            settings.CSRF_COOKIE_NAME,
            path="/",
            samesite=settings.CSRF_COOKIE_SAMESITE,
        )
        return response
