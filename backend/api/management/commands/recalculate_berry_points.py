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

            # Parcourir chaque membre individuellement
            for member in Member.objects.all():
                # Récupérer toutes les contributions de ce membre, triées par date
                member_contributions = Contribution.objects.filter(member=member).order_by('date', 'id')
                
                # CORRECTION : On suit si on a déjà traité la première contribution
                is_first_contribution_processed = False

                for contrib in member_contributions:
                    is_this_the_first_one = not is_first_contribution_processed
                    
                    # On appelle la méthode avec l'argument maintenant requis
                    impact = contrib.calculate_impact(is_first_contribution_ever=is_this_the_first_one)
                    
                    # On met à jour la contribution SANS déclencher la méthode save() complète
                    # pour éviter de recalculer le score du membre à chaque fois
                    contrib.is_late = impact['is_late']
                    contrib.points_berry = impact['points_berry']
                    contrib.save(update_fields=['is_late', 'points_berry'])
                    
                    # On ajoute les points au score total du membre
                    member.berry_score += contrib.points_berry

                    self.stdout.write(
                        f'Contribution #{contrib.id} (Membre #{member.id}, Première: {is_this_the_first_one}): '
                        f'Points: {contrib.points_berry}. Score membre -> {member.berry_score}'
                    )
                    
                    # On marque la première contribution comme traitée
                    is_first_contribution_processed = True
                
                # On sauvegarde le score final du membre une fois toutes ses contributions traitées
                member.save(update_fields=['berry_score'])
                self.stdout.write(self.style.SUCCESS(f'Score final pour Membre #{member.id}: {member.berry_score}'))

            self.stdout.write(self.style.SUCCESS('Recalcul terminé avec succès !'))