using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace EXYURadio;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new RadioWindow());
    }
}

internal sealed class RadioWindow : Form
{
    private const string RadioUrl = "https://acealeksa1234-a11y.github.io/EX-YU-Radio-Web/";
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };

    public RadioWindow()
    {
        Text = "EX-YU Radio — Aleksandar Aleksovski";
        Width = 1300;
        Height = 850;
        MinimumSize = new System.Drawing.Size(740, 530);
        StartPosition = FormStartPosition.CenterScreen;
        Icon = new System.Drawing.Icon(Path.Combine(AppContext.BaseDirectory, "EX-YU-Radio.ico"));
        BackColor = System.Drawing.Color.FromArgb(6, 12, 27);
        Controls.Add(browser);
        Shown += async (_, _) => await InitializeRadioAsync();
    }

    private async Task InitializeRadioAsync()
    {
        try
        {
            var profileDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "EX-YU-Radio", "WebView2");
            Directory.CreateDirectory(profileDirectory);
            var environment = await CoreWebView2Environment.CreateAsync(null, profileDirectory);
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            browser.CoreWebView2.NewWindowRequested += (_, request) =>
            {
                request.Handled = true;
                try
                {
                    if (Uri.TryCreate(request.Uri, UriKind.Absolute, out var uri) &&
                        (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
                    {
                        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
                    }
                }
                catch { /* A blocked external URL must not crash the radio. */ }
            };
            browser.CoreWebView2.Navigate(RadioUrl);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Ne mogu da pokrenem EX-YU Radio. Proveri internet vezu i Microsoft Edge WebView2 Runtime.\n\n"
                    + error.Message,
                "EX-YU Radio", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}
