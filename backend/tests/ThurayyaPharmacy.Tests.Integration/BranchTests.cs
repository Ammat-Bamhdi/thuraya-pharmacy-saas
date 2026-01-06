using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Tests.Integration;

public class BranchTests : IClassFixture<CustomWebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions;

    public BranchTests(CustomWebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        _jsonOptions.Converters.Add(new JsonStringEnumConverter());
    }

    private async Task<string> GetTokenAsync(string email = "admin@branchtest.com")
    {
        var registerRequest = new RegisterRequest(
            "Admin User",
            email,
            "Password123!",
            "Branch Pharmacy",
            "Saudi Arabia",
            "SAR"
        );
        var response = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(_jsonOptions);
        return result!.Data!.AccessToken;
    }

    [Fact]
    public async Task GetBranches_ReturnsSuccess()
    {
        // Arrange
        var token = await GetTokenAsync();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.GetAsync("/api/branches");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<PaginatedResponse<BranchDto>>>(_jsonOptions);
        result.Should().NotBeNull();
        result!.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Items.Should().NotBeNull();
    }
}
