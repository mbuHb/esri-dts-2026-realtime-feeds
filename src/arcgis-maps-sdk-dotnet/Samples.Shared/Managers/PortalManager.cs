using Esri.ArcGISRuntime.Mapping;
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

#if __IOS__
using System.Security.Cryptography;
using System.Text;
#elif __ANDROID__ && !NETCOREAPP
using Microsoft.Maui.Storage.SecureStorage;
#else

using System.Security.Cryptography;
using System.Text;

#endif

using ArcGIS.Samples.Managers;
using Map = Esri.ArcGISRuntime.Mapping.Map;

namespace ArcGIS.Samples.Shared.Managers
{
    public static partial class PortalManager
    {
        private static string _key;
        // Name for file on windows systems. / Name for key in .NET MAUI SecureStorage.
        private const string _apiKeyFileName = "portalResource";

        public static string PortalToken
        {
            get
            {
                // An API key is a unique long-lived access token that is used to authenticate and monitor requests to ArcGIS location services and private portal items.
                // You can create and manage an API key using your portal when you sign in with an ArcGIS Location Platform account or an ArcGIS Online account with administrator access or a custom role that has the Generate API keys privilege.
                // To learn how to create and manage API keys, go to the https://links.esri.com/create-an-api-key tutorial to create a new API key.
                // You must ensure that your API key has the correct privileges to access secure resources.
                return _key;
            }

            set
            {
                // Set the environment key when the manager key is changed.
                _key = value;
            }
        }

        public static async Task<bool> TrySetPortalToken()
        {
            // Check for a local key if a key is not already set.
            if (PortalToken == null)
            {
                try
                {
                    PortalToken = await GetPortalToken();
                    return true;
                }
                catch (Exception ex)
                {
                    Debug.WriteLine(ex.Message);
                }
            }
            return false;
        }

        private static async Task<string> GetPortalToken()
        {
            // Uncomment the following line of code, and replace the string with your developer API key. Doing this here will work on all .NET sample viewers.
            // return "YOUR_PORTAL_TOKEN_HERE";
#if __IOS__
            try
            {
                return await Task.FromResult(Encoding.Default.GetString(Decrypt(File.ReadAllBytes(Path.Combine(DataManager.GetDataFolder(), _apiKeyFileName)))));
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex.Message);
                return null;
            }
#elif ANDROID
            return await SecureStorage.GetAsync(_apiKeyFileName);
#else
            return await Task.FromResult(Encoding.Default.GetString(Unprotect(File.ReadAllBytes(Path.Combine(DataManager.GetDataFolder(), _apiKeyFileName)))));
#endif
        }

        public static bool StorePortalToken()
        {
            try
            {
#if __IOS__
                File.WriteAllBytes(Path.Combine(DataManager.GetDataFolder(), _apiKeyFileName), Encrypt(Encoding.Default.GetBytes(_key)));
                return true;
#elif ANDROID

                SecureStorage.SetAsync(_apiKeyFileName, _key);
                return true;

#else

                File.WriteAllBytes(Path.Combine(DataManager.GetDataFolder(), _apiKeyFileName), Protect(Encoding.Default.GetBytes(_key)));
                return true;

#endif
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex.Message);
                return false;
            }
        }

#if !__IOS__ && !__ANDROID__

        #region Windows Data Protection

        private const int EntropySize = 16;

        // Generates a cryptographically random IV.
        private static byte[] GenerateEntropy()
        {
            using (var rng = RandomNumberGenerator.Create())
            {
                var entropy = new byte[EntropySize];
                rng.GetBytes(entropy);
                return entropy;
            }
        }

        // Handles encrypting an array of bytes.
        private static byte[] Protect(byte[] bytes)
        {
            // Generate a random initialization vector.
            var entropy = GenerateEntropy();

            // Use the DPAPI to encrypt "bytes".
            var protectedBytes = ProtectedData.Protect(bytes, entropy, DataProtectionScope.CurrentUser);

            // Return the combined IV + protected data.
            var result = new byte[entropy.Length + protectedBytes.Length];
            System.Buffer.BlockCopy(entropy, 0, result, 0, entropy.Length);
            System.Buffer.BlockCopy(protectedBytes, 0, result, entropy.Length, protectedBytes.Length);
            return result;
        }

        // Handles decrypting an array of bytes.
        private static byte[] Unprotect(byte[] bytes)
        {
            if (bytes?.Length < EntropySize)
                throw new InvalidDataException(); // data too small, likely invalid

            // Copy IV from "bytes".
            var entropy = new byte[EntropySize];
            System.Buffer.BlockCopy(bytes, 0, entropy, 0, entropy.Length);

            // Copy protected data.
            var protectedBytes = new byte[bytes.Length - EntropySize];
            System.Buffer.BlockCopy(bytes, EntropySize, protectedBytes, 0, protectedBytes.Length);

            // Return the unprotected data.
            return ProtectedData.Unprotect(protectedBytes, entropy, DataProtectionScope.CurrentUser);
        }

        #endregion Windows Data Protection

#endif

#if __IOS__

        #region iOS Data Protection

        // NOTE: Because iOS entitlements complicate provisioning, we are not using the iOS keychain in our .NET sample viewers. The keychain entitlement is required for .NET MAUI Secure Storage.
        // For production applications, we recommend using the Microsoft.Maui.Storage Secure Storage library. https://learn.microsoft.com/en-us/dotnet/maui/platform-integration/storage/secure-storage?view=net-maui-7.0&tabs=ios

        // This is a randomly generated key used to encrypt ArcGIS API keys. Please replace this with your own randomly generated key.
        private const string iOSKey = "JHaq1bGgU1I9BVySrS33N8uNZxzo3Kug";

        // Handles encrypting an array of bytes.
        private static byte[] Encrypt(byte[] bytes)
        {
            // Create the encryptor.
            Aes aes = Aes.Create();
            aes.Key = Encoding.UTF8.GetBytes(iOSKey);
            aes.GenerateIV();
            ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

            // Encrypt the input bytes.
            byte[] protectedBytes = encryptor.TransformFinalBlock(bytes, 0, bytes.Length);

            // Return the combined IV + protected data.
            var result = new byte[aes.IV.Length + protectedBytes.Length];
            System.Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
            System.Buffer.BlockCopy(protectedBytes, 0, result, aes.IV.Length, protectedBytes.Length);
            return result;
        }

        // Handles decrypting an array of bytes.
        private static byte[] Decrypt(byte[] bytes)
        {
            // Create the decryptor.
            Aes aes = Aes.Create();
            aes.Key = Encoding.UTF8.GetBytes(iOSKey);
            aes.GenerateIV();
            ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

            // Decrypt the input bytes.
            byte[] decryptedBytes = decryptor.TransformFinalBlock(bytes, 0, bytes.Length);

            // Copy the decrypted data.
            var decryptedData = new byte[decryptedBytes.Length - aes.IV.Length];
            System.Buffer.BlockCopy(decryptedBytes, aes.IV.Length, decryptedData, 0, decryptedData.Length);

            // Return the decrypted data.
            return decryptedData;
        }

        #endregion iOS Data Protection

#endif
    }
}