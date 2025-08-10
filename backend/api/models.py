# backend/api/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import random
import string

class User(AbstractUser):
    # Extending default Django user to add roles and other fields
    ROLES = (
        ('admin', 'Administrateur'), # <<< J'ai mis 'admin' en premier par convention
        ('president', 'Président'),
        ('treasurer', 'Trésorier'),
        ('secrecom', 'Sécrécom'),
        ('censeur', 'Censeur'),
        ('accountant', 'Comptable'),
        ('member', 'Membre'),
        ('guest', 'Invité'),
    )
    role = models.CharField(max_length=20, choices=ROLES, default='guest')
    phone = models.CharField(max_length=20, blank=True, null=True)

    # Champs pour la vérification email
    is_email_verified = models.BooleanField(default=False)
    email_verification_code = models.CharField(max_length=6, blank=True, null=True)
    code_generated_at = models.DateTimeField(blank=True, null=True)
    verification_attempts = models.IntegerField(default=0)

    def save(self, *args, **kwargs):
        """
        Surcharge de la méthode save pour s'assurer qu'un superuser
        a toujours le rôle 'admin'.
        """
        # Si l'utilisateur a le drapeau is_superuser, on force son rôle à 'admin'
        if self.is_superuser:
            self.role = 'admin'
        # On appelle la méthode save() originale pour que l'objet soit sauvegardé en base de données
        super().save(*args, **kwargs)
    # <<< FIN DE LA MÉTHODE AJOUTÉE >>>

    def generate_verification_code(self):
        """Génère un nouveau code de vérification à 6 chiffres"""
        self.email_verification_code = ''.join(random.choices(string.digits, k=6))
        self.code_generated_at = timezone.now()
        self.verification_attempts = 0
        self.save()
        return self.email_verification_code

    def is_verification_code_valid(self):
        """Vérifie si le code n'a pas expiré (valide 15 minutes)"""
        if not self.code_generated_at:
            return False
        
        time_diff = timezone.now() - self.code_generated_at
        return time_diff.total_seconds() < 900  # 15 minutes

    def verify_code(self, code):
        """Vérifie le code et marque l'email comme vérifié si correct"""
        if not self.is_verification_code_valid():
            return False, "Code expiré"
        
        if self.verification_attempts >= 5:
            return False, "Trop de tentatives. Demandez un nouveau code."
        
        if self.email_verification_code == code:
            self.is_email_verified = True
            self.email_verification_code = None
            self.code_generated_at = None
            self.verification_attempts = 0
            self.save()
            return True, "Email vérifié avec succès"
        else:
            self.verification_attempts += 1
            self.save()
            return False, f"Code incorrect. {5 - self.verification_attempts} tentatives restantes."

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

# ... Le reste de vos modèles (Member, Contribution, etc.) reste identique car il est déjà correct.
class Member(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='member_profile')
    berry_score = models.IntegerField(default=20)  # Initial score at joining
    shares = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Parts d'actions

    def __str__(self):
        return self.user.get_full_name() or self.user.username

class Contribution(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='contributions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    is_late = models.BooleanField(default=False)
    points_berry = models.IntegerField(default=0)

    def __str__(self):
        return f"Contribution {self.amount} by {self.member} on {self.date}"

    def calculate_impact(self):
        """
        Calcule les points Berry et le statut de retard pour cette contribution.
        Retourne un dictionnaire avec les valeurs calculées.
        """
        from decimal import Decimal

        CONTRIBUTION_DUE_DAY = 25
        BONUS_THRESHOLD = Decimal('6800.00')
        
        # Déterminer si la contribution est en retard
        is_late = self.date.day > CONTRIBUTION_DUE_DAY
        
        points_awarded = 0
        
        # Vérifier si c'est la toute première contribution du membre
        # On vérifie s'il existe d'autres contributions pour ce membre
        is_first_contribution = not self.member.contributions.exclude(pk=self.pk).exists()

        if is_late:
            points_awarded -= 15  # Pénalité de retard
        else:
            # La récompense de 5 points ne s'applique pas à la première contribution
            if not is_first_contribution:
                points_awarded += 5
        
        # Vérifier le bonus de 70%
        if self.amount >= BONUS_THRESHOLD:
            points_awarded += 5
            
        return {
            'is_late': is_late,
            'points_berry': points_awarded
        }

    def save(self, *args, **kwargs):
        """
        Surcharge de la méthode save pour calculer et appliquer automatiquement
        l'impact sur les points Berry avant chaque sauvegarde.
        """
        # On garde en mémoire l'ancienne valeur des points
        old_points = 0
        if self.pk: # Si l'objet existe déjà en base de données
            try:
                old_points = Contribution.objects.get(pk=self.pk).points_berry
            except Contribution.DoesNotExist:
                pass # L'objet est en cours de création

        # Calculer le nouvel impact
        impact = self.calculate_impact()
        self.is_late = impact['is_late']
        self.points_berry = impact['points_berry']
        
        # Mettre à jour le score total du membre
        # On retire d'abord l'ancienne valeur, puis on ajoute la nouvelle
        self.member.berry_score = (self.member.berry_score - old_points) + self.points_berry
        self.member.save()
        
        # Appeler la méthode save originale pour sauvegarder la contribution
        super().save(*args, **kwargs)

class LoanRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'En attente'),
        ('approved', 'Approuvé'),
        ('rejected', 'Rejeté'),
        ('repaid', 'Remboursé'),
    )
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='loan_requests')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    justification = models.TextField()
    date_requested = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    interest_rate = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    repayment_due_date = models.DateField(null=True, blank=True)
    guarantors = models.ManyToManyField(Member, related_name='guaranteed_loans', blank=True)

    def __str__(self):
        return f"LoanRequest {self.amount} by {self.member} - {self.status}"

class Committee(models.Model):
    name = models.CharField(max_length=100)
    members = models.ManyToManyField(Member, related_name='committees')
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class TransactionLog(models.Model):
    TRANSACTION_TYPES = (
        ('contribution', 'Contribution'),
        ('loan_disbursement', 'Décaissement de prêt'),
        ('loan_repayment', 'Remboursement de prêt'),
        ('penalty', 'Pénalité'),
        ('other', 'Autre'),
    )
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.transaction_type} of {self.amount} by {self.member} on {self.date}"

class Sanction(models.Model):
    """
    Représente une proposition de sanction soumise au vote des membres.
    """
    SANCTION_TYPES = (
        ('Avertissement', 'Avertissement'),
        ('Amende', 'Amende'),
        ('Exclusion', 'Exclusion'),
    )
    STATUS_CHOICES = (
        ('Vote en cours', 'Vote en cours'),
        ('Appliquée', 'Appliquée'),
        ('Rejetée', 'Rejetée'),
    )

    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='sanctions')
    proposed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='proposed_sanctions')
    type = models.CharField(max_length=20, choices=SANCTION_TYPES)
    reason = models.TextField()
    date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Vote en cours')
    
    # Les votes sont maintenant gérés par le modèle SanctionVote
    # pour un suivi plus précis.

    def __str__(self):
        return f"Sanction de type '{self.type}' pour {self.member.user.username} - Statut: {self.status}"

class SanctionVote(models.Model):
    """
    Enregistre le vote d'un utilisateur pour une sanction spécifique,
    pour s'assurer qu'un utilisateur ne vote qu'une seule fois.
    """
    VOTE_CHOICES = (
        ('for', 'Pour'),
        ('against', 'Contre'),
    )
    sanction = models.ForeignKey(Sanction, on_delete=models.CASCADE, related_name='votes')
    voter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sanction_votes')
    vote = models.CharField(max_length=10, choices=VOTE_CHOICES)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Assure qu'un utilisateur ne peut voter qu'une seule fois par sanction
        unique_together = ('sanction', 'voter')

    def __str__(self):
        return f"Vote de {self.voter.username} sur la sanction #{self.sanction.id}"

class Meeting(models.Model):
    """Représente une réunion planifiée."""
    MEETING_TYPES = (
        ('Ouverture', 'Ouverture du mois'),
        ('Clôture', 'Clôture du mois'),
        ('Extraordinaire', 'Extraordinaire'),
        ('Comité', 'Comité de Gestion'),
    )
    STATUS_CHOICES = (
        ('À venir', 'À venir'),
        ('En cours', 'En cours'),
        ('Passée', 'Passée'),
    )

    title = models.CharField(max_length=200)
    date = models.DateField()
    time = models.TimeField()
    type = models.CharField(max_length=20, choices=MEETING_TYPES, default='Comité')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='À venir')
    # Pour un compte-rendu simple
    decisions = models.TextField(blank=True, null=True, help_text="Décisions clés prises durant la réunion.")

    def __str__(self):
        return f"Réunion '{self.title}' le {self.date}"

class Vote(models.Model):
    """Représente une proposition soumise à un vote général."""
    VOTE_TYPES = (
        ('Modification Charte', 'Modification Charte'),
        ('Sanction', 'Sanction'),
        ('Prêt Important', 'Prêt Important'),
        ('Règle', 'Règle'),
    )
    STATUS_CHOICES = (
        ('En cours', 'En cours'),
        ('Approuvé', 'Approuvé'),
        ('Rejeté', 'Rejeté'),
    )
    MAJORITY_TYPES = (
        ('Simple', 'Simple'),
        ('Qualifiée', 'Qualifiée'),
        ('Unanimité', 'Unanimité'),
    )

    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(max_length=50, choices=VOTE_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='En cours')
    required_majority = models.CharField(max_length=20, choices=MAJORITY_TYPES, default='Simple')
    created_at = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField()

    def __str__(self):
        return f"Vote: {self.title} ({self.status})"

class VoteRecord(models.Model):
    """Enregistre le vote d'un utilisateur pour une proposition de vote."""
    VOTE_CHOICES = (
        ('for', 'Pour'),
        ('against', 'Contre'),
    )
    vote_proposal = models.ForeignKey(Vote, on_delete=models.CASCADE, related_name='records')
    voter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vote_records')
    choice = models.CharField(max_length=10, choices=VOTE_CHOICES)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('vote_proposal', 'voter')
