export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-8">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-700 mb-4">
            By accessing and using the Stage the Change Scanner mobile application (the "App"), you accept and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the App.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
          <p className="text-gray-700 mb-4">
            Stage the Change Scanner is a mobile application designed for workshop attendance tracking at Stage the Change events. The App allows authorized staff members to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Scan QR codes to record student attendance</li>
            <li>View workshop rosters and attendance information</li>
            <li>Manually check in students when QR codes are not available</li>
            <li>Sync attendance data with our cloud database</li>
            <li>Access attendance reports and statistics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Eligibility</h2>
          <p className="text-gray-700">
            The App is intended for use by authorized event staff, administrators, and volunteers who are at least 18 years of age. By using the App, you represent and warrant that you meet these eligibility requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. User Responsibilities</h2>
          <p className="text-gray-700 mb-4">As a user of the App, you agree to:</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Use the App only for its intended purpose of attendance tracking</li>
            <li>Maintain the confidentiality of any login credentials</li>
            <li>Ensure accurate recording of attendance information</li>
            <li>Respect the privacy of students and their information</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Not misuse, modify, or attempt to gain unauthorized access to the App</li>
            <li>Not share or distribute student information outside of authorized channels</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Privacy and Security</h2>
          <p className="text-gray-700 mb-4">
            Your use of the App is also governed by our Privacy Policy, which can be found at{' '}
            <a href="/privacy" className="text-blue-600 hover:text-blue-800 underline">
              /privacy
            </a>
            . By using the App, you consent to the collection and use of information as described in our Privacy Policy.
          </p>
          <p className="text-gray-700">
            You acknowledge that the App handles sensitive student information and agree to maintain appropriate security measures on your device.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property</h2>
          <p className="text-gray-700">
            The App, including its design, functionality, and content, is owned by Stage the Change and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the App without our express written permission.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Disclaimers and Limitations of Liability</h2>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">7.1 "As Is" Basis</h3>
          <p className="text-gray-700 mb-4">
            The App is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">7.2 Limitation of Liability</h3>
          <p className="text-gray-700 mb-4">
            To the maximum extent permitted by law, Stage the Change shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Your use or inability to use the App</li>
            <li>Any unauthorized access to or use of our servers and/or any personal information stored therein</li>
            <li>Any bugs, viruses, or other harmful code that may be transmitted to or through the App</li>
            <li>Any errors, mistakes, or inaccuracies in the App</li>
            <li>Any interruption or cessation of transmission to or from the App</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Internet Connection</h2>
          <p className="text-gray-700">
            While the App offers offline functionality, certain features require an internet connection to sync data with our servers. You are responsible for obtaining and maintaining the internet connectivity required to access and use the App. We are not responsible for any fees or charges you may incur from your internet service provider.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Updates and Modifications</h2>
          <p className="text-gray-700">
            We reserve the right to modify, suspend, or discontinue the App (or any part thereof) at any time with or without notice. We may also update these Terms from time to time. Continued use of the App after such changes constitutes your acceptance of the new Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Termination</h2>
          <p className="text-gray-700">
            We reserve the right to terminate or suspend your access to the App at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason in our sole discretion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Third-Party Services</h2>
          <p className="text-gray-700">
            The App may integrate with or link to third-party services (such as Supabase for database hosting). We are not responsible for the content, privacy policies, or practices of any third-party services. Your use of third-party services is at your own risk.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Indemnification</h2>
          <p className="text-gray-700">
            You agree to indemnify, defend, and hold harmless Stage the Change, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the App or your violation of these Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
          <p className="text-gray-700">
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Stage the Change operates, without regard to its conflict of law provisions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Severability</h2>
          <p className="text-gray-700">
            If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Information</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about these Terms, please contact us:
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-2">
              <strong>Email:</strong>{' '}
              <a href="mailto:dpincus95@stagethechange.org" className="text-blue-600 hover:text-blue-800">
                dpincus95@stagethechange.org
              </a>
            </p>
            <p className="text-gray-700">
              <strong>App Name:</strong> Stage the Change Scanner
            </p>
          </div>
        </section>

        <div className="border-t pt-6 mt-8">
          <p className="text-sm text-gray-600">
            By using the Stage the Change Scanner app, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
