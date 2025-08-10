# backend/api/views/generic_views.py - VERSION CORRIGÉE AVEC ContributionDetailAPIView ET LoanRequestDetailAPIView

from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db.models import Sum
from django.utils import timezone
from ..models import Member, Contribution, LoanRequest, Committee, TransactionLog, Sanction, SanctionVote, Meeting, Vote, VoteRecord
from ..serializers import (
    UserSerializer, MemberSerializer, ContributionSerializer, 
    LoanRequestSerializer, CommitteeSerializer, TransactionLogSerializer,
    UserProfileSerializer, ChangePasswordSerializer, SanctionSerializer,
    SanctionVoteSerializer,  MeetingSerializer, VoteSerializer
)
import logging
import secrets
import string

User = get_user_model()
logger = logging.getLogger(__name__)

def generate_password(length=8):
    """Génère un mot de passe aléatoirement"""
    characters = string.ascii_letters + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

# NOUVELLES VUES POUR LE PROFIL UTILISATEUR
class UserProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Récupérer le profil de l'utilisateur connecté"""
        try:
            user = request.user
            
            # Préparer les données du profil
            profile_data = {
                'firstName': user.first_name or '',
                'lastName': user.last_name or '',
                'email': user.email or '',
                'phone': user.phone or '',  # Maintenant que le champ existe
            }
            
            return Response(profile_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération du profil: {str(e)}")
            return Response(
                {'message': 'Erreur lors de la récupération du profil'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def put(self, request):
        """Mettre à jour le profil de l'utilisateur connecté"""
        try:
            user = request.user
            serializer = UserProfileSerializer(user, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(
                    {'message': 'Profil mis à jour avec succès'}, 
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {'message': 'Données invalides', 'errors': serializer.errors}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour du profil: {str(e)}")
            return Response(
                {'message': 'Erreur lors de la mise à jour du profil'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request):
        """Changer le mot de passe de l'utilisateur connecté"""
        try:
            serializer = ChangePasswordSerializer(
                data=request.data, 
                context={'request': request}
            )
            
            if serializer.is_valid():
                user = request.user
                new_password = serializer.validated_data['newPassword']
                
                # Mettre à jour le mot de passe
                user.set_password(new_password)
                user.save()
                
                return Response(
                    {'message': 'Mot de passe mis à jour avec succès'}, 
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {'message': 'Données invalides', 'errors': serializer.errors}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"Erreur lors du changement de mot de passe: {str(e)}")
            return Response(
                {'message': 'Erreur lors du changement de mot de passe'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DashboardStatsAPIView(APIView):
    """
    Fournit un résumé des statistiques clés pour le tableau de bord.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            # Utiliser select_related pour optimiser la requête
            member = Member.objects.select_related('user').get(user=user)
            
            # Calculs pour l'état du fonds
            today = timezone.now().date()
            total_fund_result = Contribution.objects.aggregate(total=Sum('amount'))
            monthly_contributions_result = Contribution.objects.filter(
                date__year=today.year, 
                date__month=today.month
            ).aggregate(total=Sum('amount'))

            data = {
                'berry_points': member.berry_score,
                'fund_status': {
                    'total_fund': total_fund_result['total'] or 0,
                    'monthly_contributions': monthly_contributions_result['total'] or 0,
                    'active_members': Member.objects.count(),
                    'loans_in_repayment': LoanRequest.objects.filter(status='approved').count(),
                    'liquidity_rate': 'Élevé', # Logique à définir selon la charte
                }
            }
            return Response(data, status=status.HTTP_200_OK)
        
        except Member.DoesNotExist:
            return Response({'error': 'Profil membre non trouvé pour cet utilisateur.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des stats du dashboard: {str(e)}")
            return Response({'error': 'Erreur interne du serveur.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Classes de vues existantes pour les APIs REST
class UserListCreateAPIView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

# NOUVELLE VERSION AVEC DÉTAIL, MISE À JOUR ET SUPPRESSION
class MemberListCreateAPIView(generics.ListCreateAPIView):
    queryset = Member.objects.select_related('user').all()
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated]

class MemberDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """NOUVEAU: Vue pour récupérer, modifier et supprimer un membre spécifique"""
    queryset = Member.objects.all()
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated]
    
    def destroy(self, request, *args, **kwargs):
        """Suppression personnalisée d'un membre"""
        try:
            member = self.get_object()
            user = member.user
            
            # Supprimer d'abord le membre puis l'utilisateur
            member.delete()
            user.delete()
            
            logger.info(f"Membre {member.id} et utilisateur {user.username} supprimés avec succès")
            
            return Response(
                {'message': 'Membre supprimé avec succès'}, 
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du membre: {str(e)}")
            return Response(
                {'error': 'Erreur lors de la suppression du membre'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ContributionListCreateAPIView(generics.ListCreateAPIView):
    queryset = Contribution.objects.all()
    serializer_class = ContributionSerializer
    permission_classes = [IsAuthenticated]

# ✅ CLASSE AJOUTÉE POUR CORRIGER L'ERREUR 404 DELETE CONTRIBUTIONS
class ContributionDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """Vue pour récupérer, modifier et supprimer une contribution spécifique"""
    queryset = Contribution.objects.all()
    serializer_class = ContributionSerializer
    permission_classes = [IsAuthenticated]
    
    def destroy(self, request, *args, **kwargs):
        """Suppression personnalisée d'une contribution avec calcul des points Berry"""
        try:
            contribution = self.get_object()
            member = contribution.member
            
            # Réajuster les points Berry du membre avant suppression
            member.berry_score -= contribution.points_berry
            member.save()
            
            logger.info(f"Contribution {contribution.id} supprimée - {contribution.points_berry} points retirés du membre {member.id}")
            
            # Supprimer la contribution
            contribution.delete()
            
            return Response(
                {'message': 'Contribution supprimée avec succès'}, 
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            logger.error(f"Erreur lors de la suppression de la contribution: {str(e)}")
            return Response(
                {'error': 'Erreur lors de la suppression de la contribution'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def update(self, request, *args, **kwargs):
        """Mise à jour personnalisée d'une contribution avec recalcul des points Berry"""
        try:
            partial = kwargs.pop('partial', False)
            contribution = self.get_object()
            member = contribution.member
            
            # Sauvegarder les anciens points pour ajustement
            old_points = contribution.points_berry
            
            # Mettre à jour la contribution
            serializer = self.get_serializer(contribution, data=request.data, partial=partial)
            if serializer.is_valid():
                updated_contribution = serializer.save()
                
                # Recalculer les points Berry si nécessaire
                # TODO: Implémenter la logique de calcul des points Berry selon la charte
                # Pour l'instant, on garde les points existants
                
                # Réajuster le score du membre
                member.berry_score = member.berry_score - old_points + updated_contribution.points_berry
                member.save()
                
                logger.info(f"Contribution {contribution.id} mise à jour - Points ajustés: {updated_contribution.points_berry - old_points}")
                
                return Response(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour de la contribution: {str(e)}")
            return Response(
                {'error': 'Erreur lors de la mise à jour de la contribution'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class LoanRequestListCreateAPIView(generics.ListCreateAPIView):
    queryset = LoanRequest.objects.all()
    serializer_class = LoanRequestSerializer
    permission_classes = [IsAuthenticated]

# ✅ NOUVELLE CLASSE AJOUTÉE POUR CORRIGER L'ERREUR 404 PATCH LOAN-REQUESTS
class LoanRequestDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """Vue pour récupérer, modifier et supprimer une demande de prêt spécifique"""
    queryset = LoanRequest.objects.all()
    serializer_class = LoanRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        """Mise à jour personnalisée d'une demande de prêt (changement de statut principalement)"""
        try:
            partial = kwargs.pop('partial', False)
            loan_request = self.get_object()
            
            # Mettre à jour la demande de prêt
            serializer = self.get_serializer(loan_request, data=request.data, partial=partial)
            if serializer.is_valid():
                updated_loan = serializer.save()
                
                # Log du changement de statut
                if 'status' in request.data:
                    logger.info(f"Demande de prêt {loan_request.id} - Statut changé vers: {updated_loan.status}")
                
                return Response(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour de la demande de prêt: {str(e)}")
            return Response(
                {'error': 'Erreur lors de la mise à jour de la demande de prêt'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        """Suppression personnalisée d'une demande de prêt"""
        try:
            loan_request = self.get_object()
            
            # Vérifier si la demande peut être supprimée (par exemple, seulement si en attente)
            if loan_request.status != 'pending':
                return Response(
                    {'error': 'Seules les demandes en attente peuvent être supprimées'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Demande de prêt {loan_request.id} supprimée")
            
            # Supprimer la demande de prêt
            loan_request.delete()
            
            return Response(
                {'message': 'Demande de prêt supprimée avec succès'}, 
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            logger.error(f"Erreur lors de la suppression de la demande de prêt: {str(e)}")
            return Response(
                {'error': 'Erreur lors de la suppression de la demande de prêt'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CommitteeListCreateAPIView(generics.ListCreateAPIView):
    queryset = Committee.objects.all()
    serializer_class = CommitteeSerializer
    permission_classes = [IsAuthenticated]

class TransactionLogListCreateAPIView(generics.ListCreateAPIView):
    queryset = TransactionLog.objects.all()
    serializer_class = TransactionLogSerializer
    permission_classes = [IsAuthenticated]

class SanctionViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les sanctions.
    - list: Récupère la liste de toutes les sanctions.
    - create: Propose une nouvelle sanction.
    - retrieve: Récupère le détail d'une sanction.
    - vote (action): Permet à un utilisateur de voter sur une sanction.
    """
    queryset = Sanction.objects.all().order_by('-date')
    serializer_class = SanctionSerializer
    permission_classes = [IsAuthenticated] # Vous pouvez affiner avec vos permissions custom

    @action(detail=True, methods=['post'], url_path='vote')
    def vote(self, request, pk=None):
        sanction = self.get_object()
        user = request.user

        # Vérifier si l'utilisateur a le droit de voter (à affiner selon vos règles)
        # Par ex: if not user.has_perm('api.can_vote_on_sanction'):
        # ...

        # Vérifier si la sanction est toujours en cours de vote
        if sanction.status != 'Vote en cours':
            return Response(
                {'error': 'Le vote pour cette sanction est clos.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Vérifier si l'utilisateur a déjà voté
        if SanctionVote.objects.filter(sanction=sanction, voter=user).exists():
            return Response(
                {'error': 'Vous avez déjà voté pour cette sanction.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SanctionVoteSerializer(data=request.data)
        if serializer.is_valid():
            SanctionVote.objects.create(
                sanction=sanction,
                voter=user,
                vote=serializer.validated_data['vote']
            )
            logger.info(f"Vote de '{user.username}' enregistré pour la sanction #{sanction.id}")
            return Response({'status': 'Vote enregistré'}, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MeetingViewSet(viewsets.ModelViewSet):
    """ViewSet pour lister et créer des réunions."""
    queryset = Meeting.objects.all().order_by('-date', '-time')
    serializer_class = MeetingSerializer
    permission_classes = [IsAuthenticated] # À affiner

class VoteViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les propositions de vote."""
    queryset = Vote.objects.all().order_by('-created_at')
    serializer_class = VoteSerializer
    permission_classes = [IsAuthenticated] # À affiner

    @action(detail=True, methods=['post'], url_path='vote')
    def vote(self, request, pk=None):
        vote_proposal = self.get_object()
        user = request.user

        if vote_proposal.status != 'En cours':
            return Response({'error': 'Ce vote est clos.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if VoteRecord.objects.filter(vote_proposal=vote_proposal, voter=user).exists():
            return Response({'error': 'Vous avez déjà voté.'}, status=status.HTTP_400_BAD_REQUEST)

        choice = request.data.get('vote')
        if choice not in ['for', 'against']:
            return Response({'error': 'Vote invalide. Choisissez "for" ou "against".'}, status=status.HTTP_400_BAD_REQUEST)
        
        VoteRecord.objects.create(
            vote_proposal=vote_proposal,
            voter=user,
            choice=choice
        )
        logger.info(f"Vote de '{user.username}' enregistré pour la proposition #{vote_proposal.id}")
        return Response({'status': 'Vote enregistré'}, status=status.HTTP_200_OK)

class BerryScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, member_id):
        try:
            member = Member.objects.get(id=member_id)
            return Response({
                'member_id': member.id,
                'berry_score': member.berry_score,
                'member_name': member.user.get_full_name() or member.user.username
            })
        except Member.DoesNotExist:
            return Response(
                {'error': 'Membre non trouvé'}, 
                status=status.HTTP_404_NOT_FOUND
            )

# Vues fonctionnelles existantes
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_member_with_credentials(request):
    """Crée un nouveau membre et envoie automatiquement les identifiants"""
    try:
        # Vérifier les permissions
        if not request.user.has_perm('api.add_member'):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        data = request.data
        email = data.get('email', '').lower().strip()
        
        # VÉRIFICATION: Email déjà utilisé
        if User.objects.filter(email=email).exists():
            return Response(
                {'error': f'Un utilisateur avec l\'email {email} existe déjà.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(username=email).exists():
            return Response(
                {'error': f'Un utilisateur avec cet email existe déjà.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Générer le mot de passe
        password = generate_password()
        
        # Créer l'utilisateur Django
        user = User.objects.create(
            username=email,  # Utiliser l'email comme username
            email=email,
            first_name=data.get('firstName', '').strip(),
            last_name=data.get('lastName', '').strip(),
            password=make_password(password),
            role=data.get('role', 'member'),
            is_active=True  # Actif par défaut pour les membres créés par admin
        )
        
        # Créer le membre
        member = Member.objects.create(
            user=user,
            berry_score=20,  # Points initiaux
            shares=0
        )
        
        # Préparer les données pour l'envoi des notifications
        notification_data = {
            'firstName': data.get('firstName', ''),
            'lastName': data.get('lastName', ''),
            'email': email,
            'role': data.get('role', 'member'),
            'membershipNumber': f"MEM{str(user.id).zfill(3)}"
        }
        
        # Temporairement : simulation de l'envoi des identifiants
        notification_results = {
            'email_sent': False,
            'whatsapp_sent': False,
            'password': password,
            'errors': ['Service de notification temporairement désactivé']
        }
        
        serializer = MemberSerializer(member)
        response_data = {
            'member': serializer.data,
            'password_sent': True,
            'email_sent': notification_results['email_sent'],
            'whatsapp_sent': notification_results['whatsapp_sent'],
            'generated_password': notification_results['password'],
            'errors': notification_results['errors']
        }
        
        logger.info(f"Nouveau membre créé: {email} avec mot de passe: {password}")
        
        return Response(response_data, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.error(f"Erreur lors de la création du membre: {str(e)}")
        return Response(
            {'error': 'Erreur interne du serveur'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_member_role(request, member_id):
    """Mettre à jour les informations d'un membre (nom, prénom, rôle)"""
    try:
        # Vérifier les permissions
        if not request.user.has_perm('api.change_member'):
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        member = Member.objects.get(id=member_id)
        user = member.user
        data = request.data
        
        # Mettre à jour les informations de l'utilisateur
        if 'firstName' in data:
            user.first_name = data['firstName'].strip()
        if 'lastName' in data:
            user.last_name = data['lastName'].strip()
        if 'role' in data:
            user.role = data['role']
        
        user.save()
        
        # Retourner les données mises à jour
        serializer = MemberSerializer(member)
        
        logger.info(f"Membre {member.id} mis à jour: {user.first_name} {user.last_name} - Rôle: {user.role}")
        
        return Response({
            'message': 'Membre mis à jour avec succès',
            'member': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Member.DoesNotExist:
        return Response(
            {'error': 'Membre non trouvé'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du membre: {str(e)}")
        return Response(
            {'error': 'Erreur interne du serveur'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resend_member_credentials(request, member_id):
    """Renvoie les identifiants d'un membre existant"""
    try:
        member = Member.objects.get(id=member_id)
        
        # Générer un nouveau mot de passe
        new_password = generate_password()
        
        # Mettre à jour le mot de passe de l'utilisateur
        user = member.user
        user.password = make_password(new_password)
        user.save()
        
        # Préparer les données pour l'envoi
        notification_data = {
            'firstName': user.first_name,
            'lastName': user.last_name,
            'email': user.email,
            'role': user.role,
            'membershipNumber': f"MEM{str(user.id).zfill(3)}"
        }
        
        # Temporairement : simulation de l'envoi des nouveaux identifiants
        notification_results = {
            'email_sent': False,
            'whatsapp_sent': False,
            'password': new_password,
            'errors': ['Service de notification temporairement désactivé']
        }
        
        return Response({
            'message': 'Identifiants renvoyés avec succès',
            'email_sent': notification_results['email_sent'],
            'whatsapp_sent': notification_results['whatsapp_sent'],
            'new_password': notification_results['password'],
            'errors': notification_results['errors']
        }, status=status.HTTP_200_OK)
        
    except Member.DoesNotExist:
        return Response(
            {'error': 'Membre non trouvé'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Erreur lors du renvoi des identifiants: {str(e)}")
        return Response(
            {'error': 'Erreur interne du serveur'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )