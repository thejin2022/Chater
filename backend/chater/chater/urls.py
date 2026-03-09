"""
URL configuration for chater project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path,include

from accounts.views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
)

urlpatterns = [
    # Health check for cloud load balancer / uptime checks.
    path("api/health/", lambda request: JsonResponse({"status": "ok"})),

    # Django Admin
    path('admin/', admin.site.urls),

    # JWT Auth( Http only)
    path('api/auth/login/', CookieTokenObtainPairView.as_view()),
    path('api/auth/refresh/', CookieTokenRefreshView.as_view()),

    # accounts app , 利用 include 導向
    path("api/auth/", include("accounts.urls")),
    # chat app 
    path("api/chat/", include("chat.urls")),

]
