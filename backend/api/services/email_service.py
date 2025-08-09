# backend/api/services/email_service.py
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
import logging

logger = logging.getLogger(__name__)

class EmailVerificationService:
    @staticmethod
    def send_verification_email(user):
        """Envoie un email de vérification avec le code"""
        try:
            subject = 'Vérification de votre compte Friendly Banks'
            
            # Message HTML
            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%); 
                              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .code {{ background: #fff; padding: 20px; margin: 20px 0; text-align: center; 
                            border-radius: 8px; border: 2px dashed #3b82f6; }}
                    .code-number {{ font-size: 32px; font-weight: bold; color: #1d4ed8; 
                                   letter-spacing: 8px; font-family: monospace; }}
                    .warning {{ color: #dc2626; margin-top: 20px; font-size: 14px; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏦 Friendly Banks</h1>
                        <p>Vérification de votre compte</p>
                    </div>
                    <div class="content">
                        <h2>Bonjour {user.first_name or user.username},</h2>
                        <p>Merci de vous être inscrit sur Friendly Banks ! Pour activer votre compte, 
                        veuillez utiliser le code de vérification ci-dessous :</p>
                        
                        <div class="code">
                            <p>Votre code de vérification :</p>
                            <div class="code-number">{user.email_verification_code}</div>
                        </div>
                        
                        <p><strong>Instructions :</strong></p>
                        <ul>
                            <li>Saisissez ce code sur la page de vérification</li>
                            <li>Ce code est valide pendant <strong>15 minutes</strong></li>
                            <li>Vous avez droit à <strong>5 tentatives maximum</strong></li>
                        </ul>
                        
                        <p class="warning">
                            ⚠️ Si vous n'avez pas créé ce compte, ignorez cet email.
                        </p>
                        
                        <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                        <p>Cordialement,<br>L'équipe Friendly Banks</p>
                    </div>
                    <div class="footer">
                        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Message texte simple (fallback)
            plain_message = f"""
            Bonjour {user.first_name or user.username},

            Merci de vous être inscrit sur Friendly Banks !

            Votre code de vérification : {user.email_verification_code}

            Ce code est valide pendant 15 minutes.
            Vous avez droit à 5 tentatives maximum.

            Si vous n'avez pas créé ce compte, ignorez cet email.

            Cordialement,
            L'équipe Friendly Banks
            """
            
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            
            logger.info(f"Email de vérification envoyé à {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de l'email à {user.email}: {str(e)}")
            return False
    
    @staticmethod
    def send_welcome_email(user):
        """Envoie un email de bienvenue après vérification"""
        try:
            subject = 'Bienvenue dans Friendly Banks !'
            
            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); 
                              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .features {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }}
                    .feature {{ display: flex; align-items: center; margin: 10px 0; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Compte activé !</h1>
                        <p>Bienvenue dans la communauté Friendly Banks</p>
                    </div>
                    <div class="content">
                        <h2>Félicitations {user.first_name or user.username} !</h2>
                        <p>Votre compte a été vérifié avec succès. Vous faites maintenant partie 
                        de la communauté Friendly Banks !</p>
                        
                        <div class="features">
                            <h3>Ce que vous pouvez faire maintenant :</h3>
                            <div class="feature">✅ Effectuer vos contributions mensuelles</div>
                            <div class="feature">✅ Demander des prêts d'urgence</div>
                            <div class="feature">✅ Consulter vos points Berry</div>
                            <div class="feature">✅ Participer aux décisions du groupe</div>
                        </div>
                        
                        <p><strong>Rappel important :</strong> La contribution minimale mensuelle 
                        est de 4 000 XAF, à effectuer entre le 24 et 25 de chaque mois.</p>
                        
                        <p>Vous commencez avec <strong>20 points Berry</strong>. Plus vous contribuez 
                        régulièrement, plus votre score augmente !</p>
                        
                        <p>Bonne navigation sur votre plateforme !</p>
                        <p>L'équipe Friendly Banks</p>
                    </div>
                    <div class="footer">
                        <p>La confiance crée la richesse 💰</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            plain_message = f"""
            Félicitations {user.first_name or user.username} !

            Votre compte Friendly Banks a été vérifié avec succès !

            Vous pouvez maintenant :
            - Effectuer vos contributions mensuelles
            - Demander des prêts d'urgence  
            - Consulter vos points Berry
            - Participer aux décisions du groupe

            Contribution minimale : 4 000 XAF (24-25 de chaque mois)
            Points Berry de départ : 20 points

            Bienvenue dans la communauté !

            L'équipe Friendly Banks
            """
            
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            
            logger.info(f"Email de bienvenue envoyé à {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de l'email de bienvenue à {user.email}: {str(e)}")
            return False