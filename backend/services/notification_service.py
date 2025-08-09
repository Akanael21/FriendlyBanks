import smtplib
import requests
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
import os

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.whatsapp_number = "+237679428531"
        self.email_sender = "friendlybanks5@gmail.com"
    
    def generate_password(self, length=8):
        """Génère un mot de passe aléatoire"""
        import random
        import string
        characters = string.ascii_letters + string.digits
        return ''.join(random.choice(characters) for _ in range(length))
    
    def send_welcome_email(self, member_data, password):
        """Envoie un email de bienvenue avec le mot de passe"""
        try:
            subject = "Bienvenue dans Friendly Banks - Vos identifiants de connexion"
            
            # Template HTML pour l'email
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bienvenue dans Friendly Banks</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }}
                    .content {{ padding: 20px; background-color: #f9f9f9; }}
                    .credentials {{ background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
                    .button {{ display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏦 Friendly Banks</h1>
                        <p>Plateforme de Gestion Collective du Fonds d'Urgence</p>
                    </div>
                    
                    <div class="content">
                        <h2>Bienvenue {member_data['firstName']} {member_data['lastName']} !</h2>
                        
                        <p>Nous sommes ravis de vous accueillir dans la communauté Friendly Banks. Votre compte a été créé avec succès.</p>
                        
                        <div class="credentials">
                            <h3>🔐 Vos identifiants de connexion :</h3>
                            <p><strong>Email :</strong> {member_data['email']}</p>
                            <p><strong>Mot de passe :</strong> <code style="background-color: #fff; padding: 5px; border-radius: 3px;">{password}</code></p>
                        </div>
                        
                        <p><strong>⚠️ Important :</strong></p>
                        <ul>
                            <li>Changez votre mot de passe lors de votre première connexion</li>
                            <li>Ne partagez jamais vos identifiants</li>
                            <li>Votre numéro de membre : <strong>{member_data.get('membershipNumber', 'À définir')}</strong></li>
                        </ul>
                        
                        <p><strong>📋 Informations sur votre compte :</strong></p>
                        <ul>
                            <li>Rôle : {member_data.get('role', 'Membre')}</li>
                            <li>Points Berry initiaux : 20 points</li>
                            <li>Cotisation mensuelle minimale : 4,000 XAF</li>
                            <li>Date limite de cotisation : 24-25 de chaque mois</li>
                        </ul>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="http://localhost:3000/login" class="button">Se connecter maintenant</a>
                        </div>
                        
                        <p>Si vous avez des questions, n'hésitez pas à contacter l'administration.</p>
                    </div>
                    
                    <div class="footer">
                        <p>© 2024 Friendly Banks - Fonds d'Urgence Communautaire</p>
                        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Version texte simple
            text_content = f"""
            Bienvenue dans Friendly Banks !
            
            Bonjour {member_data['firstName']} {member_data['lastName']},
            
            Votre compte a été créé avec succès.
            
            Vos identifiants de connexion :
            Email : {member_data['email']}
            Mot de passe : {password}
            
            Veuillez changer votre mot de passe lors de votre première connexion.
            
            Cordialement,
            L'équipe Friendly Banks
            """
            
            # Envoi de l'email
            send_mail(
                subject=subject,
                message=text_content,
                from_email=self.email_sender,
                recipient_list=[member_data['email']],
                html_message=html_content,
                fail_silently=False,
            )
            
            logger.info(f"Email de bienvenue envoyé à {member_data['email']}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de l'email à {member_data['email']}: {str(e)}")
            return False
    
    def send_whatsapp_message(self, member_data, password):
        """Envoie un message WhatsApp avec les identifiants"""
        try:
            phone_number = member_data.get('phone', '').replace('+', '').replace(' ', '')
            
            message = f"""
🏦 *Friendly Banks - Bienvenue !*

Bonjour *{member_data['firstName']} {member_data['lastName']}* !

Votre compte a été créé avec succès.

🔐 *Vos identifiants de connexion :*
📧 Email : {member_data['email']}
🔑 Mot de passe : `{password}`

⚠️ *Important :*
• Changez votre mot de passe lors de votre première connexion
• Ne partagez jamais vos identifiants
• Numéro de membre : {member_data.get('membershipNumber', 'À définir')}

📋 *Informations sur votre compte :*
• Rôle : {member_data.get('role', 'Membre')}
• Points Berry initiaux : 20 points
• Cotisation mensuelle minimale : 4,000 XAF
• Date limite : 24-25 de chaque mois

🌐 Connectez-vous sur : http://localhost:3000/login

Bienvenue dans notre communauté !

_Message automatique - Friendly Banks_
            """
            
            # Simulation d'envoi WhatsApp (remplacer par une vraie API)
            # Pour une vraie implémentation, utiliser l'API WhatsApp Business
            whatsapp_api_url = "https://api.whatsapp.com/send"  # URL fictive
            
            # Log du message (en attendant une vraie API)
            logger.info(f"Message WhatsApp préparé pour {phone_number}: {message}")
            
            # Ici, vous pouvez intégrer une vraie API WhatsApp comme :
            # - Twilio WhatsApp API
            # - WhatsApp Business API
            # - Autres services tiers
            
            # Exemple avec une API fictive :
            """
            response = requests.post(
                "https://api.whatsapp-service.com/send",
                json={
                    "from": self.whatsapp_number,
                    "to": phone_number,
                    "message": message
                },
                headers={"Authorization": "Bearer YOUR_API_TOKEN"}
            )
            """
            
            logger.info(f"Message WhatsApp envoyé à {phone_number}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi WhatsApp à {member_data.get('phone', 'N/A')}: {str(e)}")
            return False
    
    def send_member_credentials(self, member_data):
        """Envoie les identifiants par email et WhatsApp"""
        password = self.generate_password()
        
        results = {
            'password': password,
            'email_sent': False,
            'whatsapp_sent': False,
            'errors': []
        }
        
        # Envoi de l'email
        try:
            results['email_sent'] = self.send_welcome_email(member_data, password)
        except Exception as e:
            results['errors'].append(f"Email error: {str(e)}")
        
        # Envoi du message WhatsApp
        try:
            results['whatsapp_sent'] = self.send_whatsapp_message(member_data, password)
        except Exception as e:
            results['errors'].append(f"WhatsApp error: {str(e)}")
        
        return results
