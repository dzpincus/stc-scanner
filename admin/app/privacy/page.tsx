export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
          <p className="text-gray-700 mb-4">
            Stage the Change Scanner ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how our mobile application (the "App") collects, uses, and safeguards information when you use our attendance tracking service.
          </p>
          <p className="text-gray-700">
            The Stage the Change Scanner app is designed for workshop attendance tracking and is intended for use by authorized event staff and administrators only.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 Information Provided by Event Organizers</h3>
          <p className="text-gray-700 mb-4">
            We collect and process the following information that is provided by event organizers through our admin dashboard:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Student names</li>
            <li>Student registration IDs</li>
            <li>Supervisor names and email addresses</li>
            <li>Workshop registration information</li>
            <li>Workshop details (names, time slots, locations)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2 Information Collected Through the App</h3>
          <p className="text-gray-700 mb-4">
            When you use the App to scan QR codes for attendance tracking, we collect:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>QR code data (student registration IDs)</li>
            <li>Attendance timestamps (check-in and check-out times)</li>
            <li>Device identifier (for tracking which device performed the scan)</li>
            <li>Workshop attendance information</li>
            <li>Optional notes added by staff members</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">2.3 Camera Access</h3>
          <p className="text-gray-700">
            The App requires camera access solely to scan QR codes for attendance tracking. We do not store, transmit, or process any photos or videos. The camera is used only to read QR code data in real-time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Information</h2>
          <p className="text-gray-700 mb-4">
            We use the collected information for the following purposes:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Recording and tracking workshop attendance</li>
            <li>Verifying student registrations for specific workshops</li>
            <li>Generating attendance reports for event organizers</li>
            <li>Sending attendance confirmation emails to supervisors</li>
            <li>Maintaining accurate event records</li>
            <li>Troubleshooting and improving the App's functionality</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Storage and Security</h2>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">4.1 Local Storage</h3>
          <p className="text-gray-700 mb-4">
            The App stores data locally on your device using SQLite database for offline functionality. This allows the App to work without an internet connection. Local data is synced to our secure servers when an internet connection is available.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">4.2 Cloud Storage</h3>
          <p className="text-gray-700 mb-4">
            All synced data is stored securely using Supabase (a secure, cloud-based PostgreSQL database service). We implement industry-standard security measures including:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Secure authentication and authorization</li>
            <li>Regular security updates and monitoring</li>
            <li>Access controls limiting who can view and modify data</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">4.3 Data Retention</h3>
          <p className="text-gray-700">
            We retain attendance and student data only as long as necessary for the purposes outlined in this policy or as required by law. Event organizers can request data deletion through our admin dashboard.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Information Sharing and Disclosure</h2>
          <p className="text-gray-700 mb-4">
            We do not sell, trade, or rent personal information to third parties. We may share information only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li><strong>With Event Organizers:</strong> Attendance data is accessible to authorized event administrators through our admin dashboard</li>
            <li><strong>With Supervisors:</strong> We send attendance confirmation emails to the supervisor email addresses provided during registration</li>
            <li><strong>Service Providers:</strong> We use Supabase for database hosting and email service providers for sending notifications. These providers are bound by confidentiality agreements</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government regulation</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Third-Party Services</h2>
          <p className="text-gray-700 mb-4">
            The App uses the following third-party services:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li><strong>Supabase:</strong> Database hosting and backend services. View their privacy policy at: https://supabase.com/privacy</li>
            <li><strong>Expo:</strong> Mobile app development framework. View their privacy policy at: https://expo.dev/privacy</li>
          </ul>
          <p className="text-gray-700">
            These services may collect information used to identify you. We encourage you to review their privacy policies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Children's Privacy</h2>
          <p className="text-gray-700">
            This App is designed for use by authorized event staff and administrators only. We do not knowingly collect personal information from children under 13 years of age through the App itself. However, the App may process information about minors who are registered as workshop attendees. This information is provided by event organizers and parents/guardians through the registration process.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Your Rights and Choices</h2>
          <p className="text-gray-700 mb-4">
            Depending on your location and applicable laws, you may have the following rights:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li><strong>Access:</strong> Request access to personal information we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
            <li><strong>Deletion:</strong> Request deletion of your information (subject to legal retention requirements)</li>
            <li><strong>Data Portability:</strong> Request a copy of your information in a structured format</li>
            <li><strong>Withdrawal of Consent:</strong> Withdraw consent for data processing where consent was the legal basis</li>
          </ul>
          <p className="text-gray-700">
            To exercise these rights, please contact us using the information provided in Section 11.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Camera Permission</h2>
          <p className="text-gray-700 mb-4">
            The App requires camera permission to scan QR codes for attendance tracking. You can manage this permission through your device settings:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li><strong>iOS:</strong> Settings → Privacy & Security → Camera → Stage the Change Scanner</li>
            <li><strong>Android:</strong> Settings → Apps → Stage the Change Scanner → Permissions → Camera</li>
          </ul>
          <p className="text-gray-700">
            Note: Denying camera permission will prevent the App from scanning QR codes, which is its primary function.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to This Privacy Policy</h2>
          <p className="text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. Continued use of the App after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
          <p className="text-gray-700 mb-4">
            If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-2">
              <strong>Email:</strong> <a href="mailto:dpincus95@stagethechange.org" className="text-blue-600 hover:text-blue-800">dpincus95@stagethechange.org</a>
            </p>
            <p className="text-gray-700">
              <strong>App Name:</strong> Stage the Change Scanner
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Legal Basis for Processing (GDPR)</h2>
          <p className="text-gray-700 mb-4">
            If you are located in the European Economic Area (EEA), our legal basis for collecting and using information depends on the specific information and context:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li><strong>Legitimate Interests:</strong> Processing is necessary for attendance tracking and event management</li>
            <li><strong>Consent:</strong> You have given consent for specific purposes (e.g., camera access)</li>
            <li><strong>Legal Obligations:</strong> Processing is necessary to comply with legal requirements</li>
          </ul>
        </section>

        <div className="border-t pt-6 mt-8">
          <p className="text-sm text-gray-600">
            By using the Stage the Change Scanner app, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
