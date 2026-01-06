using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Tests.Integration;

public class AuthTests : IClassFixture<CustomWebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions;

    public AuthTests(CustomWebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        _jsonOptions.Converters.Add(new JsonStringEnumConverter());
    }

    [Fact]
    public async Task Register_WithValidData_ReturnsSuccess()
    {
        // Arrange
        var request = new RegisterRequest(
            "Test User",
            "test@example.com",
            "Password123!",
            "Test Pharmacy",
            "Saudi Arabia",
            "SAR"
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        // Assert
        if (response.StatusCode != HttpStatusCode.OK)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new Exception($"Registration failed with status {response.StatusCode}. Error: {errorContent}");
        }
        
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(_jsonOptions);
        result.Should().NotBeNull();
        result!.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.User.Email.Should().Be("test@example.com");
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsSuccess()
    {
        // Arrange
        var registerRequest = new RegisterRequest(
            "Login User",
            "login@example.com",
            "Password123!",
            "Login Pharmacy",
            "Saudi Arabia",
            "SAR"
        );
        var regResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        if (regResponse.StatusCode != HttpStatusCode.OK)
        {
            var errorContent = await regResponse.Content.ReadAsStringAsync();
            throw new Exception($"Registration for login failed with status {regResponse.StatusCode}. Error: {errorContent}");
        }

        var loginRequest = new LoginRequest("login@example.com", "Password123!");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);

        // Assert
        if (response.StatusCode != HttpStatusCode.OK)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new Exception($"Login failed with status {response.StatusCode}. Error: {errorContent}");
        }

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(_jsonOptions);
        result.Should().NotBeNull();
        result!.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.AccessToken.Should().NotBeNullOrEmpty();
    }
}
