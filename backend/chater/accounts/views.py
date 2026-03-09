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



# 取得使用者資訊
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "username": request.user.username,
            "user_id": request.user.id,
        })




class CsrfTokenView(APIView):
    """
    提供前端主動取得 CSRF cookie 的入口。
    前端在送出 POST/PUT/PATCH/DELETE 前，可先呼叫此 API。
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        token = get_token(request)
        return Response({
            "detail": "CSRF cookie set",
            "csrfToken": token,
        })





# 打包 token 成 HttpOnly Cookie
from rest_framework_simplejwt.views import TokenObtainPairView

class CookieTokenObtainPairView(TokenObtainPairView):
    """
    登入成功後：
    - 不回傳 access / refresh
    - 改用 HttpOnly Cookie
    """

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        # 如果帳密錯誤，SimpleJWT 會回 401
        if response.status_code != status.HTTP_200_OK:
            return response

        access = response.data.get("access")
        refresh = response.data.get("refresh")

        # 清空 body（前端拿不到 token）
        response.data = {"detail": "login success"}

        # 設定 HttpOnly Cookie
        response.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=False,      # 本地端 False，正式上線要設定成 True
            samesite="Lax",
            max_age=60 * 15,
        )

        response.set_cookie(
            key="refresh_token",
            value=refresh,
            httponly=True,
            secure=False,
            samesite="Lax",
            max_age=60 * 60 * 24 * 7,
        )

        return response



# 處理 token 過期用 refresh token 持續更新 access token
from rest_framework_simplejwt.views import TokenRefreshView


class CookieTokenRefreshView(TokenRefreshView):
    """
    從 HttpOnly cookie 讀 refresh token
    再更新 access token
    """

    def post(self, request, *args, **kwargs):
        # 把 cookie 裡的 refresh token 塞回 request.data
        refresh = request.COOKIES.get("refresh_token")
        if refresh:
            request.data["refresh"] = refresh

        response = super().post(request, *args, **kwargs)

        if response.status_code != status.HTTP_200_OK:
            return response

        access = response.data.get("access")
        response.data = {"detail": "token refreshed"}

        response.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=False, # 這部分是因為本地需要，正式環境也得是 True
            samesite="Lax", # 之後一定要改不能是 None , lax 是安全預設
            max_age=60 * 15,
        )

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

        response.delete_cookie("access_token", samesite="Lax")
        response.delete_cookie("refresh_token", samesite="Lax")
        response.delete_cookie("csrftoken", samesite="Lax")
        return response
