# backend/api/views/auth_views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
from ..models import Member
from ..services.email_service import EmailVerificationService
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def signup_view(request):
    """Inscription d'un nouvel utilisateur avec envoi du code de vérification"""
    try:
        data = request.data
        
        # Validation des données
        required_fields = ['firstName', 'lastName', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return Response({
                    'error': f"Le champ {field} est requis."
                }, status=status.HTTP_400_BAD_REQUEST)
        
        email = data.get('email').lower().strip()
        
        # Vérifier si l'email existe déjà
        if User.objects.filter(email=email).exists():
            return Response({
                'email': ["Un compte avec cet email existe déjà."]
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier si le nom d'utilisateur existe déjà (utiliser l'email comme username)
        if User.objects.filter(username=email).exists():
            return Response({
                'email': ["Cet email est déjà utilisé."]
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validation du mot de passe
        password = data.get('password')
        if len(password) < 8:
            return Response({
                'password': ["Le mot de passe doit contenir au moins 8 caractères."]
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Création de l'utilisateur dans une transaction
        with transaction.atomic():
            user = User.objects.create_user(
                username=email,  # Utiliser l'email comme nom d'utilisateur
                email=email,
                first_name=data.get('firstName', '').strip(),
                last_name=data.get('lastName', '').strip(),
                password=password,
                is_active=False,  # Compte inactif jusqu'à vérification
                role='guest'  # Rôle par défaut
            )
            
            # Ajouter le téléphone si fourni
            if data.get('phone'):
                user.phone = data.get('phone').strip()
                user.save()
            
            # Générer le code de vérification
            verification_code = user.generate_verification_code()
            
            # Envoyer l'email de vérification
            email_sent = EmailVerificationService.send_verification_email(user)
            
            if not email_sent:
                # Si l'email n'a pas pu être envoyé, supprimer l'utilisateur
                user.delete()
                return Response({
                    'error': "Erreur lors de l'envoi de l'email de vérification. Veuillez réessayer."
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        logger.info(f"Nouvel utilisateur créé: {email}")
        
        return Response({
            'message': "Compte créé avec succès ! Un code de vérification a été envoyé à votre email.",
            'email': email,
            'user_id': user.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Erreur lors de l'inscription: {str(e)}")
        return Response({
            'error': "Une erreur inattendue s'est produite. Veuillez réessayer."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email_view(request):
    """Vérification du code email"""
    try:
        data = request.data
        email = data.get('email', '').lower().strip()
        code = data.get('code', '').strip()
        
        if not email or not code:
            return Response({
                'error': "Email et code de vérification requis."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': "Utilisateur non trouvé."
            }, status=status.HTTP_404_NOT_FOUND)
        
        if user.is_email_verified:
            return Response({
                'error': "Email déjà vérifié."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier le code
        is_valid, message = user.verify_code(code)
        
        if is_valid:
            # Activer le compte et créer le profil Member
            with transaction.atomic():
                user.is_active = True
                user.role = 'member'  # Passer de guest à member
                user.save()
                
                # Créer le profil Member avec 20 points Berry initiaux
                Member.objects.create(
                    user=user,
                    berry_score=20,
                    shares=0
                )
            
            # Envoyer l'email de bienvenue
            EmailVerificationService.send_welcome_email(user)
            
            logger.info(f"Email vérifié pour l'utilisateur: {email}")
            
            return Response({
                'message': "Email vérifié avec succès ! Votre compte est maintenant actif.",
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'berry_score': 20
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': message
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Erreur lors de la vérification: {str(e)}")
        return Response({
            'error': "Une erreur inattendue s'est produite. Veuillez réessayer."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification_code_view(request):
    """Renvoyer un nouveau code de vérification"""
    try:
        data = request.data
        email = data.get('email', '').lower().strip()
        
        if not email:
            return Response({
                'error': "Email requis."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': "Utilisateur non trouvé."
            }, status=status.HTTP_404_NOT_FOUND)
        
        if user.is_email_verified:
            return Response({
                'error': "Email déjà vérifié."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Générer un nouveau code
        verification_code = user.generate_verification_code()
        
        # Envoyer l'email
        email_sent = EmailVerificationService.send_verification_email(user)
        
        if email_sent:
            logger.info(f"Nouveau code envoyé à: {email}")
            return Response({
                'message': "Un nouveau code de vérification a été envoyé à votre email."
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': "Erreur lors de l'envoi de l'email. Veuillez réessayer."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Erreur lors du renvoi du code: {str(e)}")
        return Response({
            'error': "Une erreur inattendue s'est produite. Veuillez réessayer."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_verification_status_view(request):
    """Vérifier le statut de vérification d'un email"""
    email = request.GET.get('email', '').lower().strip()
    
    if not email:
        return Response({
            'error': "Email requis."
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        return Response({
            'is_verified': user.is_email_verified,
            'is_active': user.is_active,
            'code_valid': user.is_verification_code_valid() if not user.is_email_verified else False,
            'attempts_remaining': max(0, 5 - user.verification_attempts) if not user.is_email_verified else 0
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({
            'error': "Utilisateur non trouvé."
        }, status=status.HTTP_404_NOT_FOUND)