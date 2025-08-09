from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Member, Contribution, LoanRequest, Committee, TransactionLog, Sanction, SanctionVote, Meeting, Vote, VoteRecord

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name']

# NOUVEAU : Serializer pour le profil utilisateur
class UserProfileSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(source='first_name', max_length=30)
    lastName = serializers.CharField(source='last_name', max_length=30)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['firstName', 'lastName', 'email', 'phone']
        
    def update(self, instance, validated_data):
        # Mettre à jour les champs du modèle User
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.phone = validated_data.get('phone', instance.phone)
        
        instance.save()
        return instance

# NOUVEAU : Serializer pour le changement de mot de passe
class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=True)
    newPassword = serializers.CharField(required=True)
    
    def validate_newPassword(self, value):
        validate_password(value)
        return value
    
    def validate_currentPassword(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Le mot de passe actuel est incorrect.")
        return value

class MemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = Member
        fields = ['id', 'user', 'berry_score', 'shares']

class ContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = ['id', 'member', 'amount', 'date', 'is_late', 'points_berry']

class LoanRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanRequest
        fields = ['id', 'member', 'amount', 'justification', 'date_requested', 'status', 'interest_rate', 'repayment_due_date', 'guarantors']

class CommitteeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Committee
        fields = ['id', 'name', 'members', 'description']

class TransactionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionLog
        fields = ['id', 'member', 'transaction_type', 'amount', 'date', 'description']

class SanctionVoteSerializer(serializers.ModelSerializer):
    """Serializer pour l'action de voter."""
    class Meta:
        model = SanctionVote
        fields = ['vote']

class SanctionSerializer(serializers.ModelSerializer):
    """Serializer principal pour la ressource Sanction."""
    member_name = serializers.CharField(source='member.user.get_full_name', read_only=True)
    # Les champs `votes_for` et `votes_against` seront calculés
    votes_for = serializers.SerializerMethodField()
    votes_against = serializers.SerializerMethodField()
    # Le champ `has_voted` indiquera si l'utilisateur de la requête a déjà voté
    has_voted = serializers.SerializerMethodField()
    
    class Meta:
        model = Sanction
        # 'member' est en écriture, 'member_name' en lecture.
        fields = [
            'id', 'member', 'member_name', 'type', 'reason', 
            'date', 'status', 'votes_for', 'votes_against', 'has_voted'
        ]
        read_only_fields = ['status', 'date']

    def get_votes_for(self, obj):
        """Compte les votes 'pour'."""
        return obj.votes.filter(vote='for').count()

    def get_votes_against(self, obj):
        """Compte les votes 'contre'."""
        return obj.votes.filter(vote='against').count()

    def get_has_voted(self, obj):
        """Vérifie si l'utilisateur courant a déjà voté."""
        user = self.context['request'].user
        if user.is_anonymous:
            return False
        return obj.votes.filter(voter=user).exists()

    def create(self, validated_data):
        """Associe l'utilisateur qui propose la sanction."""
        user = self.context['request'].user
        validated_data['proposed_by'] = user
        return super().create(validated_data)

class MeetingSerializer(serializers.ModelSerializer):
    """Serializer pour les réunions."""
    class Meta:
        model = Meeting
        fields = ['id', 'title', 'date', 'time', 'type', 'status', 'decisions']

class VoteSerializer(serializers.ModelSerializer):
    """Serializer pour les propositions de vote."""
    votes_for = serializers.SerializerMethodField()
    votes_against = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()

    class Meta:
        model = Vote
        fields = [
            'id', 'title', 'description', 'type', 'status', 
            'required_majority', 'end_date', 'votes_for', 'votes_against', 'has_voted'
        ]
    
    def get_votes_for(self, obj):
        return obj.records.filter(choice='for').count()

    def get_votes_against(self, obj):
        return obj.records.filter(choice='against').count()

    def get_has_voted(self, obj):
        user = self.context['request'].user
        return obj.records.filter(voter=user).exists()
