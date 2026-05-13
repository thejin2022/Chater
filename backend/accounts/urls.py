from django.urls import path
from .views import (
    CsrfTokenView, 
    LogoutView, 
    MeView, 
    RegisterView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    )

urlpatterns = [
    # JWT Auth( HttpOnly)
     path("csrf/", CsrfTokenView.as_view()),
    path('login/', CookieTokenObtainPairView.as_view()),
    path('refresh/', CookieTokenRefreshView.as_view()),
    path("register/", RegisterView.as_view()),
    path("me/", MeView.as_view()),
    path("logout/", LogoutView.as_view()),

]
