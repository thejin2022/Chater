# 自訂 Authentication , 讓 DRF 的 JWTAuthentication 從 HttpOnly Cookie 讀取 token，並強制 CSRF 驗證。
# 對應 setting.py 中 REST_FRAMEWORK 的 DEFAULT_AUTHENTICATION_CLASSES。
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
  

    def enforce_csrf(self, request):
        """
        強制進行Django CSRF 驗證。
        - DRF 的 JWTAuthentication 預設不做 CSRF 檢查
        - 當 JWT 存在 HttpOnly Cookie 時，瀏覽器會自動夾帶 cookie
        - 若不額外檢查，會產生 CSRF 風險
        因此在非 SAFE_METHODS 時主動驗證。
        """
        csrf_check = CSRFCheck(lambda req: None)
        csrf_check.process_request(request)
        reason = csrf_check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
    
    def authenticate(self, request):
        """
        從 Http request cookie 讀取 JWT token，並驗證。
        在 setting.py 中 REST_FRAMEWORK HttpOnly 認證
         - 成功：回傳 (user, validated_token)
         - 失敗：回傳 None
         - 注意：不會丟出例外，讓 DRF 的 permission classes 處理權限問題
        """

        raw_token = request.COOKIES.get("access_token")
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        # 只有會改變資料的 method 才需要 CSRF token 驗證。
        if request.method not in SAFE_METHODS:
            self.enforce_csrf(request)

        return user, validated_token
