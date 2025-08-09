# backend/api/urls.py - VERSION FINALE AVEC ROUTEUR POUR VIEWSETS

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Importer les ViewSets
from .views.generic_views import (
    MemberDetailAPIView, ContributionDetailAPIView, LoanRequestDetailAPIView,
    SanctionViewSet, MeetingViewSet, VoteViewSet
)

# Importer les vues APIView et fonctionnelles
from .views import generic_views as views
from .views.auth_views import (
    signup_view,
    verify_email_view,
    resend_verification_code_view,
    check_verification_status_view
)

# ============================================
# CONFIGURATION DU ROUTEUR POUR LES VIEWSETS
# ============================================
router = DefaultRouter()
# Enregistrez ici tous vos ViewSets. Pour l'instant, seulement SanctionViewSet.
# Si vous convertissez Member, Contribution, etc. en ViewSets, ajoutez-les ici.
router.register(r'sanctions', views.SanctionViewSet, basename='sanction')
router.register(r'meetings', views.MeetingViewSet, basename='meeting')
router.register(r'votes', views.VoteViewSet, basename='vote')

# ============================================
# LISTE DES URLS
# ============================================
urlpatterns = [
    # Inclure les URLs générées par le routeur
    path('', include(router.urls)),

    # ============================================
    # AUTHENTICATION & VÉRIFICATION EMAIL
    # ============================================
    path('signup/', signup_view, name='signup'),
    path('verify-email/', verify_email_view, name='verify_email'),
    path('resend-verification/', resend_verification_code_view, name='resend_verification'),
    path('check-verification-status/', check_verification_status_view, name='check_verification_status'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/', include('rest_framework.urls', namespace='rest_framework')),

    # ============================================
    # ROUTES SPÉCIFIQUES (NON-VIEWSET)
    # ============================================
    # Users, Members, Contributions, Loans...
    path('users/', views.UserListCreateAPIView.as_view(), name='user-list'),
    path('members/', views.MemberListCreateAPIView.as_view(), name='member-list'),
    path('members/<int:pk>/', views.MemberDetailAPIView.as_view(), name='member-detail'),
    path('contributions/', views.ContributionListCreateAPIView.as_view(), name='contribution-list'),
    path('contributions/<int:pk>/', views.ContributionDetailAPIView.as_view(), name='contribution-detail'),
    path('loan-requests/', views.LoanRequestListCreateAPIView.as_view(), name='loanrequest-list'),
    path('loan-requests/<int:pk>/', views.LoanRequestDetailAPIView.as_view(), name='loanrequest-detail'),
    
    # Autres
    path('committees/', views.CommitteeListCreateAPIView.as_view(), name='committee-list'),
    path('transactions/', views.TransactionLogListCreateAPIView.as_view(), name='transactionlog-list'),
    path('berry-score/<str:member_id>/', views.BerryScoreAPIView.as_view(), name='berry_score'),
    
    # Profil Utilisateur
    path('user/profile/', views.UserProfileAPIView.as_view(), name='user-profile'),
    path('user/change-password/', views.ChangePasswordAPIView.as_view(), name='change-password'),
    path('dashboard-stats/', views.DashboardStatsAPIView.as_view(), name='dashboard-stats'),
    
    # Vues fonctionnelles
    path('members/create-with-credentials/', views.create_member_with_credentials, name='create-member-credentials'),
    path('members/<int:member_id>/update-role/', views.update_member_role, name='update-member-role'),
    path('members/<int:member_id>/resend-credentials/', views.resend_member_credentials, name='resend-member-credentials'),
]