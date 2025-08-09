from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Member, Contribution, LoanRequest, Committee, TransactionLog

User = get_user_model()

class FriendlyBanksAPITestCase(APITestCase):
    def setUp(self):
        # Create users with different roles
        self.admin_user = User.objects.create_user(username='admin', password='adminpass', role='admin', is_staff=True, is_superuser=True)
        self.president_user = User.objects.create_user(username='president', password='presidentpass', role='president')
        self.treasurer_user = User.objects.create_user(username='treasurer', password='treasurerpass', role='treasurer')
        self.member_user = User.objects.create_user(username='member', password='memberpass', role='member')

        # Create members linked to users
        self.president_member = Member.objects.create(user=self.president_user)
        self.treasurer_member = Member.objects.create(user=self.treasurer_user)
        self.member_member = Member.objects.create(user=self.member_user)

        # API clients for each user
        self.admin_client = APIClient()
        self.admin_client.login(username='admin', password='adminpass')

        self.president_client = APIClient()
        self.president_client.login(username='president', password='presidentpass')

        self.treasurer_client = APIClient()
        self.treasurer_client.login(username='treasurer', password='treasurerpass')

        self.member_client = APIClient()
        self.member_client.login(username='member', password='memberpass')

    def test_user_list_admin_only(self):
        url = reverse('user-list')
        # Admin can access
        response = self.admin_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Non-admin cannot access
        response = self.president_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_contribution_creation_minimum_amount(self):
        url = reverse('contribution-list')
        data = {
            'member': self.president_member.id,
            'amount': 3000,  # Below minimum
            'date': '2024-06-20'
        }
        response = self.president_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        data['amount'] = 5000  # Above minimum
        response = self.president_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_loan_request_guarantors_validation(self):
        url = reverse('loanrequest-list')
        data = {
            'member': self.member_member.id,
            'amount': 50000,
            'justification': 'Medical emergency',
            'guarantors': [self.president_member.id]  # Only one guarantor
        }
        response = self.member_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        data['guarantors'] = [self.president_member.id, self.treasurer_member.id]  # Two guarantors
        response = self.member_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_berry_score_endpoint(self):
        url = reverse('berry_score', args=[self.member_member.id])
        response = self.member_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('berry_score', response.data)

    def test_role_based_access_control(self):
        # Contribution creation allowed for president and treasurer
        url = reverse('contribution-list')
        data = {
            'member': self.president_member.id,
            'amount': 5000,
            'date': '2024-06-20'
        }
        response = self.president_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.member_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # Additional tests can be added for committees, transactions, exports, etc.
