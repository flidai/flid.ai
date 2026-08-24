package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestStaticHandlerServesCleanDirectoryRoutes(t *testing.T) {
	root := fixtureSite(t)
	handler, err := newStaticHandler(root)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		path string
		want string
	}{
		{path: "/", want: "home"},
		{path: "/about", want: "about"},
		{path: "/about/", want: "about"},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			handler.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
			}
			if response.Body.String() != test.want {
				t.Fatalf("body = %q, want %q", response.Body.String(), test.want)
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("Cache-Control = %q, want no-store", response.Header().Get("Cache-Control"))
			}
			if response.Header().Get("Content-Type") != "text/html; charset=utf-8" {
				t.Fatalf("Content-Type = %q", response.Header().Get("Content-Type"))
			}
		})
	}
}

func TestStaticHandlerSupportsHeadAndByteRanges(t *testing.T) {
	root := fixtureSite(t)
	handler, err := newStaticHandler(root)
	if err != nil {
		t.Fatal(err)
	}

	headResponse := httptest.NewRecorder()
	handler.ServeHTTP(headResponse, httptest.NewRequest(http.MethodHead, "/", nil))
	if headResponse.Code != http.StatusOK {
		t.Fatalf("HEAD status = %d, want %d", headResponse.Code, http.StatusOK)
	}
	if headResponse.Body.Len() != 0 {
		t.Fatalf("HEAD body length = %d, want 0", headResponse.Body.Len())
	}

	rangeResponse := httptest.NewRecorder()
	rangeRequest := httptest.NewRequest(http.MethodGet, "/clip.mp4", nil)
	rangeRequest.Header.Set("Range", "bytes=2-5")
	handler.ServeHTTP(rangeResponse, rangeRequest)
	if rangeResponse.Code != http.StatusPartialContent {
		t.Fatalf("range status = %d, want %d", rangeResponse.Code, http.StatusPartialContent)
	}
	if rangeResponse.Body.String() != "2345" {
		t.Fatalf("range body = %q, want %q", rangeResponse.Body.String(), "2345")
	}
	if rangeResponse.Header().Get("Content-Range") != "bytes 2-5/10" {
		t.Fatalf("Content-Range = %q", rangeResponse.Header().Get("Content-Range"))
	}
}

func TestStaticHandlerRejectsUnsupportedAndUnsafeRequests(t *testing.T) {
	root := fixtureSite(t)
	handler, err := newStaticHandler(root)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name   string
		method string
		path   string
		status int
	}{
		{name: "missing", method: http.MethodGet, path: "/missing", status: http.StatusNotFound},
		{name: "method", method: http.MethodPost, path: "/", status: http.StatusMethodNotAllowed},
		{name: "traversal", method: http.MethodGet, path: "/../secret", status: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(test.method, test.path, nil)
			handler.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d", response.Code, test.status)
			}
		})
	}
}

func TestNewStaticHandlerRequiresDirectory(t *testing.T) {
	_, err := newStaticHandler(filepath.Join(t.TempDir(), "missing"))
	if err == nil {
		t.Fatal("expected an error for a missing site root")
	}
}

func fixtureSite(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	writeFixture(t, filepath.Join(root, "index.html"), "home")
	writeFixture(t, filepath.Join(root, "about", "index.html"), "about")
	writeFixture(t, filepath.Join(root, "clip.mp4"), "0123456789")
	return root
}

func writeFixture(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if _, err := io.WriteString(file, contents); err != nil {
		t.Fatal(err)
	}
}
