# backend/api/views/__init__.py

# Importer toutes les vues depuis generic_views
from .generic_views import (
    UserListCreateAPIView,
    MemberListCreateAPIView,
    MemberDetailAPIView,  # NOUVEAU
    ContributionListCreateAPIView,
    LoanRequestListCreateAPIView,
    CommitteeListCreateAPIView,
    TransactionLogListCreateAPIView,
    BerryScoreAPIView,
    UserProfileAPIView,
    ChangePasswordAPIView,
    create_member_with_credentials,
    update_member_role,  # NOUVEAU
    resend_member_credentials,
)

# Importer les vues d'authentification
from .auth_views import (
    signup_view,
    verify_email_view,
    resend_verification_code_view,
    check_verification_status_view,
)