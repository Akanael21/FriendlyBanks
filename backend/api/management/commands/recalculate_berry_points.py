from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Contribution, Member

class Command(BaseCommand):
    help = 'Recalcule les points Berry pour toutes les contributions existantes et met à jour le score des membres.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Début du recalcul des points Berry...'))

        with transaction.atomic():
            # Réinitialiser tous les scores des membres à leur valeur de base (20)
            Member.objects.all().update(berry_score=20)
            self.stdout.write(self.style.WARNING('Scores de tous les membres réinitialisés à 20.'))

            # Récupérer tous les membres pour mettre à jour leur score en mémoire
            members = {m.id: m for m in Member.objects.all()}

            # Parcourir toutes les contributions par ordre chronologique
            contributions = Contribution.objects.all().order_by('date', 'id')
            
            for contrib in contributions:
                old_points = contrib.points_berry
                impact = contrib.calculate_impact() # Utilise la nouvelle logique du modèle
                
                contrib.is_late = impact['is_late']
                contrib.points_berry = impact['points_berry']
                contrib.save(update_fields=['is_late', 'points_berry']) # Sauvegarde sans redéclenchement de la logique `save` complète
                
                # Mettre à jour le score du membre en mémoire
                member = members.get(contrib.member.id)
                if member:
                    # On retire l'ancienne valeur (qui était probablement 0) et on ajoute la nouvelle
                    member.berry_score = (member.berry_score - old_points) + contrib.points_berry

                self.stdout.write(f'Contribution #{contrib.id}: {old_points} pts -> {contrib.points_berry} pts. Membre #{member.id} score -> {member.berry_score}')

            # Sauvegarder tous les scores membres mis à jour en une seule fois
            for member in members.values():
                member.save(update_fields=['berry_score'])
            
            self.stdout.write(self.style.SUCCESS('Recalcul terminé avec succès !'))