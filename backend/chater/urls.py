"""
URL configuration for chater project.
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path,include

from accounts.views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
)

urlpatterns = [
    path("api/health/", lambda request: JsonResponse({"status": "ok"})),

    path('admin/', admin.site.urls),

    # JWT Auth( HttpOnly)
    path('api/auth/login/', CookieTokenObtainPairView.as_view()),
    path('api/auth/refresh/', CookieTokenRefreshView.as_view()),

    
    path("api/auth/", include("accounts.urls")),
    path("api/chat/", include("chat.urls")),

]
