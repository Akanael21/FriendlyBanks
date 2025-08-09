from rest_framework import permissions

class RoleBasedPermission(permissions.BasePermission):
    """
    Custom permission to allow access based on user role.
    """

    def has_permission(self, request, view):
        # Allow safe methods for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated

        # Define role-based permissions per view or action
        # Example: Only president and treasurer can create contributions
        if hasattr(view, 'required_roles'):
            return request.user.role in view.required_roles

        # Default deny
        return False
