"""
URL configuration for chater project.
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path,include



urlpatterns = [
    path("api/health/", lambda request: JsonResponse({"status": "ok"})),
    
    path('admin/', admin.site.urls),    
    path("api/auth/", include("accounts.urls")),
    path("api/chat/", include("chat.urls")),

]
